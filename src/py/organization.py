import webapp2
import datetime
from google.appengine.ext import db
import logging
from login import *
import profile

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
    opportunities = db.TextProperty()   # CSV of Opportunity IDs


def remove_from_csv(val, csv):
    csv = csv.split(",")
    csv = [x for x in csv if x != str(val)]
    return ",".join(csv)
    

def resign_from_organization(profid, org):
    admins = remove_from_csv(profid, org.administrators)
    coords = remove_from_csv(profid, org.coordinators)
    unassoc = remove_from_csv(profid, org.unassociated)
    if (admins != org.administrators or coords != org.coordinators or
        unassoc != org.unassociated):
        org.administrators = admins
        org.coordinators = coords
        org.unassociated = unassoc
        org.put()


def note_resignations(profid, prevorgids, currorgids):
    prevorgids = (prevorgids or "").split(",")
    currorgids = (currorgids or "").split(",")
    for prevorgid in prevorgids:
        if prevorgid and not prevorgid in currorgids:
            org = Organization.get_by_id(intz(prevorgid))
            resign_from_organization(profid, org)


@db.transactional(xg=True)
def note_requested_association(prof, org):
    orgid = str(org.key().id())
    prof.orgs = prof.orgs or ""
    if not orgid in prof.orgs:
        if prof.orgs:
            prof.orgs += ","
        prof.orgs += orgid
        prof.put()
    profid = str(prof.key().id())
    org.administrators = org.administrators or ""
    org.coordinators = org.coordinators or ""
    org.unassociated = org.unassociated or ""
    if not org.administrators:  # taking over abandoned org
        org.administrators = profid
        org.put()
    elif profid in org.administrators:  # already associated
        pass
    elif profid in org.coordinators:    # already associated
        pass
    elif profid in org.unassociated:    # association already requested
        pass
    else:
        if org.unassociated:
            org.unassociated += ","
        org.unassociated += profid
        org.put()
    return [ prof, org ]


class OrgById(webapp2.RequestHandler):
    def get(self):
        orgid = self.request.get('orgid')
        if not orgid or not intz(orgid):
            self.error(412)  # Precondition Failed
            self.response.out.write("No orgid specified")
            return
        org = Organization.get_by_id(intz(orgid))
        if not org:
            self.error(404)  # Not Found
            self.response.out.write("Organization id: " + orgid + " not found.")
            return
        returnJSON(self.response, [ org ])


class SaveOrganization(webapp2.RequestHandler):
    def post(self):
        myprof = profile.authprof(self)
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
        org.opportunities = self.request.get("opportunities")
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
        myprof = profile.authprof(self)
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

