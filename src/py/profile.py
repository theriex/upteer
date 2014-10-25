import webapp2
import datetime
from google.appengine.ext import db
from google.appengine.api import images
import logging
from login import *

# The email address is verified by confirmation.  Before that the
# status field may be filled out with a token or other value.  The
# profile only shows up on the site if Available or Busy.
class Profile(db.Model):
    """ A volunteer profile """
    # the profile is tied to an account via the email address
    email = db.StringProperty(required=True)    # lowercase
    zipcode = db.StringProperty(required=True)  # 5 numbers (+4 not used)
    modified = db.StringProperty()              # ISO date
    name = db.StringProperty()                  # displayed on site
    status = db.StringProperty()                # Available/Busy/Inactive
    profpic = db.BlobProperty()
    about = db.TextProperty()
    skills = db.TextProperty()                  # skill keywords CSV
    lifestat = db.TextProperty()                # life status keywords CSV
    mailverify = db.StringProperty()            # ISO date
    orgs = db.StringProperty()                  # CSV of org IDs


def set_profile_fields(req, prof):
    prof.email = req.get('email') or ""
    prof.email = prof.email.lower()
    prof.zipcode = req.get('zipcode') or ""
    prof.name = req.get('name') or ""
    prof.status = req.get('status') or "Available"
    if not prof.profpic:
        prof.status = "No Pic"
    elif prof.status == "No Pic":
        prof.status = "Available"
    prof.about = req.get('about') or ""
    prof.skills = req.get('skills') or ""
    prof.lifestat = req.get('lifestat') or ""
    prof.orgs = req.get('orgs') or ""


def verify_profile_fields(handler, prof):
    if not re.match(r"[^@]+@[^@]+\.[^@]+", prof.email):
        handler.error(412)
        handler.response.out.write("Invalid email address.")
        return False
    if not re.match(r"\d\d\d\d\d", prof.zipcode):
        handler.error(413)
        handler.response.out.write("Zipcode must be exactly 5 digits.")
        return False
    return True


def authprof(handler):
    acc = authenticated(handler.request)
    if not acc:
        # Eventual consistency means it is possible to create a new
        # account but not have it available for authorization yet.
        # Other than that, the most common case is that a token has
        # expired, in which case a 401 error is exactly appropriate.
        handler.error(401)
        handler.response.out.write("Authentication failed")
        return None
    profs = Profile.gql("WHERE email = :1 LIMIT 1", acc.email)
    found = profs.count()
    if found:
        return profs[0]
    return None


class MyProfile(webapp2.RequestHandler):
    def get(self):
        result = []
        prof = authprof(self)
        if prof:
            result = [ prof ]
        returnJSON(self.response, result)


class SaveProfile(webapp2.RequestHandler):
    def post(self):
        prof = authprof(self)
        if not prof:
            prof = Profile(email=self.request.get('email'),
                           zipcode=self.request.get('zipcode'))
        set_profile_fields(self.request, prof)
        if not verify_profile_fields(self, prof):
            return
        prof.put();
        returnJSON(self.response, [ prof ])


# Authentication is not required, but only public information is returned.
class ProfileById(webapp2.RequestHandler):
    def get(self):
        profid = self.request.get('profid')
        prof = Profile.get_by_id(intz(profid))
        if not prof:
            self.error(404) # Not Found
            self.response.out.write("No profile found with id: " + profid)
            return
        # strip all non-public information
        prof.email = ""
        prof.mailverify = ""
        returnJSON(self.response, [ prof ])


class UploadProfPic(webapp2.RequestHandler):
    def get(self):
        self.response.headers['Content-Type'] = 'text/html'
        self.response.write('Ready')
    def post(self):
        errmsg = "You are not authorized to update this profile pic"
        acc = authenticated(self.request)
        if not acc:
            self.error(401)
            self.response.out.write("Authentication failed")
            return
        profid = self.request.get('_id')
        profile = Profile.get_by_id(intz(profid))
        if not profile:
            self.error(404)
            self.response.out.write("Error: Could not find profile " + profid)
            return
        if acc.email != profile.email:
            self.error(403)
            self.response.out.write("Error: Profile does not match account")
            return
        upfile = self.request.get("picfilein")
        if not upfile:
            self.error(400)
            self.response.out.write("Error: No picfilein value")
            return
        try:
            profile.profpic = db.Blob(upfile)
            # resize to at most 160x160 while preserving relative dims
            profile.profpic = images.resize(profile.profpic, 160, 160)
            profile.modified = nowISO()
            if profile.status == "No Pic":
                profile.status = "Available"
            profile.put()
        except Exception as e:
            self.error(400)
            self.response.out.write("Error: " + str(e))
            return
        self.response.headers['Content-Type'] = 'text/html'
        self.response.out.write("Done: " + profile.modified)


class GetProfPic(webapp2.RequestHandler):
    def get(self):
        profid = self.request.get('profileid')
        prof = Profile.get_by_id(intz(profid))
        if not prof and prof.profpic:
            self.error(404)
            self.response.out.write("Profile pic for Profile " + str(profid) +
                                    " not found.")
            return
        img = images.Image(prof.profpic)
        img.resize(width=160, height=160)
        img = img.execute_transforms(output_encoding=images.PNG)
        self.response.headers['Content-Type'] = "image/png"
        self.response.out.write(img)



app = webapp2.WSGIApplication([('/myprofile', MyProfile),
                               ('/saveprof', SaveProfile),
                               ('/profbyid', ProfileById),
                               ('/profpicupload', UploadProfPic),
                               ('/profpic', GetProfPic)
                               ], debug=True)

