import webapp2
import datetime
from google.appengine.ext import db
import logging

# Some organizations might want to store application forms with their
# profile, but this is better served by having the organization upload
# the forms to a site and then referencing that url from here.  If
# they don't have a site they can use a service like google docs.
class Organization(db.Model):
    name = db.StringProperty(required=True)
    parent = db.StringProperty()      # id of parent org
    website = db.StringProperty()     # url of website
    applylink = db.StringProperty()   # link to primary application form
    formslink = db.StringProperty()   # link to page with other forms
    phone = db.StringProperty()
    email = db.StringProperty()
    address = db.StringProperty()

