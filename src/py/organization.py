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
    modified = db.StringProperty()               # iso date
    status = db.StringProperty()        # Pending, Approved, Inactive
    administrators = db.TextProperty()  # CSV of profIDs that approve coords
    coordinators = db.TextProperty()    # CSV of profIDs that create opps
    parent = db.StringProperty()        # id of parent org
    # links include a link to the website, volunteer application forms
    # and/or other custom link type labels
    links = db.TextProperty()           # JSON
    phone = db.StringProperty()
    email = db.StringProperty()
    address = db.StringProperty()

