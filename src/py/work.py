import webapp2
import datetime
from google.appengine.ext import db
import logging


# Work hours are filled out by the volunteer (with calc help) based on
# the specified tracking interval, but they are subject to approval by
# the volunteer coordinator.  At the longest, things are rectified
# monthly (can't let things float for too long).  The coordinator has
# up to 18 days to contest completed hours, after that they are
# automatically approved and cannot be modified via the site.
#   Contacted (vol): Set on inquiry, 0 hrs
#   Responded (coord): Optionally set on initial response
#   Withdrawn (vol): Offer didn't work out, 0 hrs
#   Volunteering (vol): Start date set, hours filled in
#   Done (vol): Completed but not approved yet.
#   Canceled (coord): Opportunity didn't work out, 0 hrs
#   No Show (coord): 0 hrs
#   Partial (coord): Complete but total hours reduced by coordinator
#   Modified (coord): Total hours corrected upwards by coordinator
#   Completed (coord/site): Satisfactory completion, hours as specified
class WorkPeriod(db.Model):
    volunteer = db.StringProperty(required=True)   # ID of volunteer
    opportunity = db.StringProperty(required=True) # ID of opportunity
    tracking = db.StringProperty(required=True)    # Daily, Weekly, Monthly
    modified = db.StringProperty()        # ISO date
    renew = db.IntegerProperty()          # auto re-approves remaining
    start = db.StringProperty()           # ISO date
    end = db.StringProperty()             # ISO date
    status = db.StringProperty()          # Volunteering, Completed etc
    hours = db.IntegerProperty()          # Total hours volunteered
