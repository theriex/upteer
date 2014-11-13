import webapp2
import datetime
from google.appengine.ext import db
import logging
from login import *
import profile
import organization
import match


# Opportunities range from definite times and places to open ended
# flexible situations
class Opportunity(db.Model):
    name = db.StringProperty(required=True)
    name_c = db.StringProperty(required=True)  # canonized name for matching
    organization = db.IntegerProperty(required=True)  # Organization ID
    contact = db.StringProperty(required=True)       # Profile ID CSV (min 1)
    modified = db.StringProperty()          # ISO date
    accstart = db.StringProperty()          # ISO date of accounting start
    zipcode = db.StringProperty()           # up to 5 numbers
    status = db.StringProperty()            # Inactive, Open, Completed
    description = db.TextProperty()         # General description
    # Both time and location may be "TBD" or "Flexible".  Time may be 
    # intervallic repeating or a start/end.  Hours may be specific or
    # specified as an availability window.  Not database matchable.
    spacetime = db.TextProperty()           # JSON
    accessibility = db.TextProperty()       # CSV of access options
    accesscomment = db.TextProperty()       # accessibility details
    skills = db.TextProperty()              # CSV of required/desired skills


def owning_organization(handler, myprof, orgid):
    org = None
    try:
        org = organization.Organization.get_by_id(intz(orgid))
    except Exception as e:
        logging.info("owning_organization fetch failure: " + str(e))
        pass
    if not org:
        handler.error(412)  # Precondition Failed
        handler.response.out.write("Organization " + str(orgid) + " not found")
        return
    profid = str(myprof.key().id())
    if not profid in org.administrators and not profid in org.coordinators:
        handler.error(403)  # Forbidden
        self.response.out.write("Not an administrator or coordinator")
        return
    return org


def verify_unique_opportunity_name(handler, name_c, orgid, oppid):
    where = "WHERE name_c = :1 AND organization = :2 AND status = :3 LIMIT 1"
    opps = Opportunity.gql(where, name_c, orgid, "Open")
    found = opps.count()
    if found:
        if oppid and oppid != opps[0].key().id():
            handler.error(412)  # Precondition Failed
            handler.response.out.write("Open opportunity with same name")
            return False
    return True


@db.transactional(xg=True)
def save_organization_opportunity(opp, org):
    opp.put()
    oppid = str(opp.key().id())
    org.opportunities = org.opportunities or ""
    if not oppid in org.opportunities:
        if org.opportunities:
            org.opportunities += ","
        org.opportunities += oppid
        org.put()
    return [ opp, org ]


class OpportunityById(webapp2.RequestHandler):
    def get(self):
        oppid = self.request.get('oppid')
        if not oppid or not intz(oppid):
            self.error(412)  # Precondition Failed
            self.response.out.write("No oppid specified")
            return
        opp = Opportunity.get_by_id(intz(oppid))
        if not opp:
            self.error(404)  # Not Found
            self.response.out.write("Opportunity id: " + oppid + " not found.")
            return
        returnJSON(self.response, [ opp ])


class SaveOpportunity(webapp2.RequestHandler):
    def post(self):
        myprof = profile.authprof(self)
        if not myprof:
            return  # not authorized, error already reported
        orgid = intz(self.request.get('organization'))
        org = owning_organization(self, myprof, orgid)
        if not org:
            return  # owning organization not available or not authorized
        opp = None
        oppid = intz(self.request.get('_id'))
        if oppid:
            opp = Opportunity.get_by_id(oppid)
        name = self.request.get('name')
        name_c = canonize(name)
        if not verify_unique_opportunity_name(self, name_c, orgid, oppid):
            return  # name not unique within open opps within org
        contact = str(self.request.get('contact')) or str(myprof.key().id())
        prevskills = ""
        if not opp:
            opp = Opportunity(name=name, name_c=name_c, organization=orgid,
                              contact=contact)
        else:
            prevskills = opp.skills
            opp.name = name
            opp.name_c = name_c
            opp.organization = orgid
            opp.contact = contact
        opp.modified = nowISO()
        opp.accstart = self.request.get('accstart')
        opp.zipcode = self.request.get('zipcode')
        opp.status = self.request.get('status')
        opp.description = self.request.get('description')
        opp.spacetime = self.request.get('spacetime')
        opp.accessibility = self.request.get('accessibility')
        opp.accesscomment = self.request.get('accesscomment')
        opp.skills = self.request.get('skills')
        if opp.skills and len(opp.skills.split(",")) > 22:
            self.error(412)  # Precondition failed
            self.response.out.write("Listing too many desired skills.")
            return;
        opp, org = save_organization_opportunity(opp, org)
        match.update_match_nodes("opportunity", opp.key().id(), 
                                 prevskills, opp.skills)
        returnJSON(self.response, [ opp, org ])


app = webapp2.WSGIApplication([('/oppbyid', OpportunityById),
                               ('/oppsave', SaveOpportunity)
                               ], debug = True)
