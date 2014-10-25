import webapp2
import datetime
from google.appengine.ext import db
import logging
from login import *
from profile import authprof

# Some organizations might want to store application forms with their
# profile, but this is better served by having the organization upload
# the forms to a site and then referencing that url from here.  If
# they don't have a site, they can use a service like google docs.
class Organization(db.Model):
    name = db.StringProperty(required=True)
    name_c = db.StringProperty(required=True)  # canonized name for matching
    modified = db.StringProperty()      # ISO date
    status = db.StringProperty()        # Pending, Approved, Inactive
    administrators = db.TextProperty()  # CSV of profIDs that approve coords
    coordinators = db.TextProperty()    # CSV of profIDs that create opps
    unassociated = db.TextProperty()    # CSV of profIDs to be dealt with
    # The details field includes a link to their logo, a link to their
    # website, phone, email, physical address, supporting links to
    # things like volunteer application forms etc.  Fields and values
    # are flexible and not worth indexing.
    details = db.TextProperty()         # JSON


@db.transactional(xg=True)
def note_requested_association(prof, org):
    org.unnassociated = org.unnassociated or ""
    if org.unnassociated:
        org.unnassociated += ","
    org.unnassociated += str(prof.key().id())
    prof.orgs = prof.orgs or ""
    if prof.orgs:
        prof.orgs += ","
    prof.orgs += str(org.key().id())
    prof.put()
    org.put()
    return [ prof, org ]



class OrgById(webapp2.RequestHandler):
    def get(self):
        orgid = self.request.get('orgid')
        org = Organization.get_by_id(intz(orgid))
        returnJSON(self.response, [ org ])


class SaveOrganization(webapp2.RequestHandler):
    def post(self):
        myprof = authprof(self)
        if not myprof:
            return
        org = None
        orgid = intz(self.request.get('_id'))
        if orgid:
            org = Organization.get_by_id(orgid)
            if org and not str(myprof.key().id()) in org.administrators:
                self.error(403)  # Forbidden
                self.response.out.write("Only administrators can edit")
                return
        name = self.request.get('name')
        name_c = canonize(name)
        orgs = Organization.gql("WHERE name_c = :1 LIMIT 1", name_c)
        found = orgs.count()
        if found: 
            if orgid and orgid != orgs[0].key().id():
                self.error(412) # Precondition Failed
                self.response.out.write("New organization name must be unique")
                return
        if not org:
            org = Organization(name=name, name_c=name_c)
        org.name = name
        org.name_c = name_c
        org.modified = nowISO()
        status = self.request.get('status')
        if not status or org.status == 'Pending':
            org.status = "Pending"
        else:  # should probably be either "Approved" or "Inactive"
            org.status = status
        org.administrators = self.request.get('administrators')
        org.coordinators = self.request.get('coordinators')
        org.unassociated = self.request.get('unassociated')
        org.details = self.request.get('details')
        # You can remove yourself as an administrator, but there has
        # to be at least one administrator left as a final contact.
        # Not checking too thoroughly, this is more just supporting
        # standard procedure and making sure nothing gets orphaned.
        if not org.administrators:
            org.administrators = str(myprof.key().id())
        org.put();
        returnJSON(self.response, [ org ])


class AssociationRequest(webapp2.RequestHandler):
    def post(self):
        myprof = authprof(self)
        if not myprof:
            return
        profid = intz(self.request.get('profid'))
        if profid != myprof.key().id():
            self.error(403)  # Forbidden
            self.response.out.write("You can only ask to associate yourself")
            return
        org = Organization.get_by_id(intz(self.request.get('orgid')))
        if not org:
            self.error(404)  # Not Found
            self.response.out.write("Could not find organization")
            return
        if not str(profid) in org.unnassociated:
            myprof, org = note_requested_association(myprof, org)
        returnJSON(self.response, [ myprof, org ])


class NameMatch(webapp2.RequestHandler):
    def get(self):
        pre = canonize(self.request.get('pre'))
        orgquery = Organization.gql("WHERE name_c >= :1 LIMIT 5", pre)
        orgs = orgquery.fetch(5, read_policy=db.EVENTUAL_CONSISTENCY,
                              deadline=10)
        returnJSON(self.response, orgs)


app = webapp2.WSGIApplication([('/orgbyid', OrgById),
                               ('/orgsave', SaveOrganization),
                               ('/orgassoc', AssociationRequest),
                               ('/orgnames', NameMatch)
                               ], debug = True)

