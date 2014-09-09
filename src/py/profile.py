import webapp2
import datetime
from google.appengine.ext import db
import logging

class Profile(db.Model):
    """ A volunteer profile """
    email = db.StringProperty(required=True)    # lowercase
    zipcode = db.StringProperty(required=True)  # 5 numbers (+4 not used)
    name = db.StringProperty()                  # displayed on site
    profpic = db.BlobProperty()
    utid = db.StringProperty()                  # UpteerAccount ID
    skills = db.TextProperty()                  # skill keywords CSV
    lifestat = db.TextProperty()                # life status keywords CSV
    modified = db.StringProperty()              # iso date


