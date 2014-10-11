import webapp2
import datetime
from google.appengine.ext import db
import logging

# Opportunities can range from very definite times and places to
# fairly open ended situations that are flexible depending on a
# variety of factors.
class Opportunity(db.Model):
    title = db.StringProperty(required=True)
    organization = db.StringProperty(required=True)
    contact = db.StringProperty(required=True)
    modified = db.StringProperty()          # ISO date
    coordinators = db.TextProperty()        # CSV of additional contacts
    zipcode = db.StringProperty()           # up to 5 numbers
    status = db.StringProperty()            # Open, Completed, Inactive
    # Both time and location may be "TBD" or "Flexible".  Time may be 
    # intervallic repeating or a start/end.  Hours may be specific or
    # specified as an availability window.  Not database matchable.
    spacetime = db.TextProperty()

