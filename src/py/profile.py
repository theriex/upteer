import webapp2
import datetime
from google.appengine.ext import db
import logging
from login import *

class Profile(db.Model):
    """ A volunteer profile """
    # the profile is tied to an account via the email address
    email = db.StringProperty(required=True)    # lowercase
    zipcode = db.StringProperty(required=True)  # 5 numbers (+4 not used)
    name = db.StringProperty()                  # displayed on site
    status = db.StringProperty()                # Available/Busy/Inactive
    profpic = db.BlobProperty()
    skills = db.TextProperty()                  # skill keywords CSV
    lifestat = db.TextProperty()                # life status keywords CSV
    modified = db.StringProperty()              # iso date


def set_profile_fields(req, prof):
    prof.email = req.get('email') or ""
    prof.email = prof.email.lower()
    prof.zipcode = req.get('zipcode') or ""
    prof.name = req.get('name') or ""
    prof.status = req.get('status') or "Available"
    prof.skills = req.get('skills') or ""
    prof.lifestat = req.get('lifestat') or ""


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



app = webapp2.WSGIApplication([('/myprofile', MyProfile),
                               ('/saveprof', SaveProfile)], debug=True)

