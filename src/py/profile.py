import webapp2
import datetime
from google.appengine.ext import db
from google.appengine.api import images
import logging
from login import *
import organization
import match
import string
import random


# The email address is verified by confirmation.  Before that the
# status field may be filled out with a token or other value.  The
# profile only shows up on the site if Available or Busy.
class Profile(db.Model):
    """ A volunteer profile """
    # the profile is tied to an account via the email address
    email = db.StringProperty(required=True)    # lowercase
    zipcode = db.StringProperty(required=True)  # 5 numbers (+4 not used)
    modified = db.StringProperty()              # ISO date
    accessed = db.StringProperty()              # ISO date
    name = db.StringProperty()                  # displayed on site
    status = db.StringProperty()                # Available/Busy/Inactive
    profpic = db.BlobProperty()
    about = db.TextProperty()
    settings = db.TextProperty()                # ad hoc JSON fields
    skills = db.TextProperty()                  # skill keywords CSV
    lifestat = db.TextProperty()                # life status keywords CSV
    orgs = db.TextProperty()                    # CSV of org IDs
    book = db.TextProperty()                    # Contact book JSON


def set_profile_fields(req, prof):
    prof.email = req.get('email') or ""
    prof.email = prof.email.lower()
    prof.zipcode = req.get('zipcode') or ""
    prof.name = req.get('name') or ""
    if prof.status in ["Available", "Busy", "Inactive"]:
        reqstat = req.get('status') or prof.status
        if reqstat in ["Available", "Busy", "Inactive"]:
            prof.status = reqstat;
    if not prof.profpic:
        prof.status = "No Pic"
    if prof.status == "No Pic" and prof.profpic:
        prof.status = ""  # initialized by confirm_profile
    prof.about = req.get('about') or ""
    prof.settings = req.get('settings') or ""
    prof.skills = req.get('skills') or ""
    prof.lifestat = req.get('lifestat') or ""
    prof.orgs = req.get('orgs') or ""
    # book is updated separately


def verify_profile_fields(handler, prof):
    if not re.match(r"[^@]+@[^@]+\.[^@]+", prof.email):
        handler.error(412)  # Precondition Failed
        handler.response.out.write("Invalid email address.")
        return False
    if not re.match(r"\d\d\d\d\d", prof.zipcode):
        handler.error(412)  # Precondition Failed
        handler.response.out.write("Zipcode must be exactly 5 digits.")
        return False
    if prof.skills and len(prof.skills.split(",")) > 22:
        handler.error(412)  # Precondition Failed
        handler.response.out.write("Listing too many volunteering skills.")
        return False
    return True


def is_known_profile_status(statval):
    if statval == "No Pic" or statval in ["Available", "Busy", "Inactive"]:
        return True
    if statval.startswith("Pending"):
        elements = csv_list(statval)
        if len(elements) >= 4:
            return True
    return False


def confirm_profile(handler, prof):
    if prof.status in ["Available", "Busy", "Inactive"]:
        return True
    side = handler.request.get('side')
    if not is_known_profile_status(prof.status):
        prof.status = ""  # Unknown value. Re-initialize.
    if not prof.status:   # either re-initialized or never set
        side = "sendprofverify"
    if side == "sendprofverify":
        stat = prof.status or "Pending,0,1970-01-01T00:00:00Z,"
        statelems = csv_list(stat)
        count = int(statelems[1]) + 1
        code = statelems[3]
        if not code:
            chars = string.ascii_letters + string.digits
            code = "".join(random.choice(chars) for _ in range(30))
        prof.status = ",".join(["Pending", str(count), nowISO(), code])
        profid = prof.key().id()
        url = "https://www.upteer.com/verprof?profid=" +\
            str(prof.key().id()) + "&code=" + code
        logging.info("Profile verification " + prof.email + " (" + 
                     prof.name + ") url: " + url)
        if not handler.request.url.startswith('http://localhost'):
            mailtxt = "Aloha " + prof.name + ",\n\nPlease click this link to confirm your email address and activate your profile:\n\n" + url + "\n\nMahalo for joining Upteer!\n\n"
            mail.send_mail(
                sender="Upteer Administrator <admin@upteer.com>",
                to=prof.email,
                subject="Upteer profile activation",
                body=mailtxt)


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
            prof.accessed = nowISO()
            prof.put()
            if prof.status and prof.status.startswith("Pending"):
                prof.status = "Pending"  # do not send auth code to client
            result = [ prof ]
        returnJSON(self.response, result)


class SaveProfile(webapp2.RequestHandler):
    def post(self):
        prof = authprof(self)
        profid = 0
        if not prof:
            prof = Profile(email=self.request.get('email'),
                           zipcode=self.request.get('zipcode'))
        else:
            profid = prof.key().id()
        prevorgs = prof.orgs or ""
        prevskills = prof.skills or ""
        set_profile_fields(self.request, prof)
        if not verify_profile_fields(self, prof):
            return
        organization.note_resignations(profid, prevorgs, prof.orgs)
        confirm_profile(self, prof)
        prof.put()
        profid = prof.key().id()
        mode = "Clear"
        if prof.status == "Available" or prof.status == "Busy":
            mode = "Update"
        match.update_match_nodes("profile", profid, 
                                 prevskills, prof.skills, mode)
        if prof.status and prof.status.startswith("Pending"):
            prof.status = "Pending"  # do not send auth code to client
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
        prof.email = "removed"
        prof.settings = ""
        if not prof.status in ["Available", "Busy", "Inactive"]:
            prof.status = "Pending"
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
                profile.status = ""
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


class VerifyProfile(webapp2.RequestHandler):
    def get(self):
        profid = self.request.get('profid')
        prof = Profile.get_by_id(intz(profid))
        if not prof:
            self.error(404)
            self.response.out.write("Profile " + str(profid) + " not found.")
            return
        reqcode = self.request.get('code')
        authelems = csv_list(prof.status)
        # status, send count, send timestamp, verification code
        if not authelems or len(authelems) < 4:
            self.redirect("/?view=profile&profid=" + str(profid))
            return
        authcode = csv_list(prof.status)[3]
        if reqcode != authcode:
            self.error(403)  # Forbidden
            self.response.out.write("Code " + reqcode + " does not match.")
            return
        prof.status = "Available"
        prof.put()
        self.response.headers['Content-Type'] = 'text/html'
        self.response.out.write("<!DOCTYPE html>\n<html>\n<head>\n<meta http-equiv=\"Content-Type\" content=\"text/html; charset=UTF-8\">\n<title>Upteer Account Validation</title>\n</head>\n<body>\n<p>Your profile has been verified!</p><p><a href=\"../\"><h2>Return to Upteer site</h2></a></p>\n</body></html>")


app = webapp2.WSGIApplication([('/myprofile', MyProfile),
                               ('/saveprof', SaveProfile),
                               ('/profbyid', ProfileById),
                               ('/profpicupload', UploadProfPic),
                               ('/profpic', GetProfPic),
                               ('/verprof', VerifyProfile)
                               ], debug=True)

