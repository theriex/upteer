import webapp2
import datetime
from google.appengine.ext import db
import logging
import urllib
import json
from login import *
import profile
import opportunity

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
    volunteer = db.IntegerProperty(required=True)   # ID of volunteer
    opportunity = db.IntegerProperty(required=True) # ID of opportunity
    tracking = db.StringProperty(required=True)     # Daily, Weekly, Monthly
    modified = db.StringProperty()        # ISO date
    renew = db.IntegerProperty()          # auto re-approves remaining
    start = db.StringProperty()           # ISO date
    end = db.StringProperty()             # ISO date
    status = db.StringProperty()          # Volunteering, Completed etc
    hours = db.IntegerProperty()          # Total hours volunteered


def book_for_profile(prof):
    book = []
    if prof.book:
        book = json.loads(prof.book)
    return book


def write_profile_book(prof, book):
    prof.book = json.dumps(book)
    logging.info("write_profile_book: " + prof.book);
    prof.put()


def find_book_entry(book, prof):
    profidstr = str(prof.key().id())
    entry = None
    for item in book:
        if item[1] == profidstr:
            entry = item
            break
    return entry


def retention_filter(comms):
    retentions = { 'vol': 1, 'vli': 3, 'wrk': 1, 'wrd': 3, 'cov': 20, 
                   'a2b': 1, 'b2a': 1, 'sha': 5, 'shr': 20,
                   'ema': 1, 'emc': 1, 'emr': 1, 'emd': 1, 
                   'ign': 1, 'alw': 1 }
    fcs = []
    for comm in comms:
        code = comm[1]
        if retentions[code] > 0:
            fcs.append(comm)
            retentions[code] -= 1
    return fcs


def prepend_comm(handler, owner, prof, comm):
    book = book_for_profile(owner)
    entry = find_book_entry(book, prof)
    if not entry:
        entry = [prof.name, str(prof.key().id()), "", [], ""]
        book.append(entry)
    code = comm[1]
    if code in ['vli', 'sha', 'emc', 'emd']:
        entry[2] = prof.email
    # "Here's a ~!@#$%^&*()_ \"difficult\" msgtxt value? Or, not..."
    comm[2] = safeURIEncode(comm[2])
    comms = entry[3]
    comms.insert(0, comm)
    entry[3] = retention_filter(comms)
    write_profile_book(owner, book)


def most_recent_comm(entry, codestr):
    comms = entry[3]
    for comm in comms:
        if codestr == comm[1]:
            return comm
    return None


def is_friend(myprof, prof):
    # Mutually listed in contact books, or worked together.
    # The logic here is equivalent to isFriend in contact.js
    book = book_for_profile(myprof)
    entry = find_book_entry(book, prof)
    if entry and ((most_recent_comm(entry, "a2b") and
                   most_recent_comm(entry, "b2a")) or
                  most_recent_comm(entry, "cov")):
        return True
    return False


def is_opp_contact(prof, opp):
    if str(prof.key().id()) in csv_list(opp.contact):
        return True
    return False


def verify_opp(handler, prof, oppid):
    opp = opportunity.Opportunity.get_by_id(oppid)
    if not opp:
        handler.error(412)  # Precondition Failed
        handler.response.out.write("Opportunity " + oppid + " not found")
        return
    if not is_opp_contact(prof, opp):
        handler.error(412)  # Precondition Failed
        handler.response.out.write(prof.name + " not contact for " + opp.name)
        return
    return opp


def verify_work_period(handler, myprof, opp, wpid):
    wp = WorkPeriod.get_by_id(wpid)
    if not wp:
        handler.error(412)  # Precondition Failed
        handler.response.out.write("WorkPeriod " + wpid + " not found")
        return
    if wp.opportunity != opp.key().id():
        handler.error(412)  # Precondition Failed
        handler.response.out.write("WorkPeriod does not match opportunity")
        return
    # TODO: a coordinator has update rights in some phases...
    if wp.volunteer != myprof.key().id():
        handler.error(403)  # Forbidden
        handler.response.out.write("Can only complete your own WorkPeriod")
        return


def contact_volunteer_inquiry(handler, myprof, prof, msgtxt, oppid):
    # Preventing creation of a second inquiry is only checked
    # client-side for now.
    opp = verify_opp(handler, prof, oppid)
    if not opp:
        return
    tstamp = nowISO()
    wp = WorkPeriod(volunteer=myprof.key().id(), opportunity=oppid,
                    tracking="Weekly")
    wp.modified = tstamp
    wp.status = "Inquiring"
    wp.put()
    wpid = str(wp.key().id())
    prepend_comm(handler, myprof, prof, 
                 [tstamp, 'vol', msgtxt, opp.name, str(oppid), str(wpid)])
    prepend_comm(handler, prof, myprof,
                 [tstamp, 'vli', msgtxt, opp.name, str(oppid), str(wpid)])
    returnJSON(handler.response, [ myprof, wp ])


def contact_work_done(handler, myprof, prof, msgtxt, oppid, wpid):
    opp = verify_opp(handler, prof, oppid)
    if not opp:
        return
    wp = verify_work_period(handler, myprof, opp, wpid)
    if not wp:
        return;
    tstamp = nowISO()
    wp.modified = tstamp
    wp.status = "Done"
    wp.put()
    prepend_comm(handler, myprof, prof,
                 [tstamp, 'wrk', msgtxt, opp.name, str(oppid), str(wpid)])
    prepend_comm(handler, prof, myprof,
                 [tstamp, 'wrd', msgtxt, opp.name, str(oppid), str(wpid)])
    returnJSON(handler.response, [ myprof, wp ])


def contact_add_to_book(handler, myprof, prof):
    tstamp = nowISO()
    prepend_comm(handler, myprof, prof, [tstamp, 'a2b'])
    prepend_comm(handler, prof, myprof, [tstamp, 'b2a'])
    returnJSON(handler.response, [ myprof ])


def contact_share_opportunity(handler, myprof, prof, msgtxt, oppid):
    # Preventing repeated sharing of the same opportunity with the
    # same person is only checked client side for now.
    opp = verify_opp(handler, prof, oppid)
    if not opp:
        return
    if not (is_opp_contact(prof, opp) or is_friend(myprof, prof)):
        handler.error(403)  # Forbidden
        handler.response.out.write("Must be a coordinator or friend to share.")
        return
    tstamp = nowISO()
    prepend_comm(handler, myprof, prof,
                 [tstamp, 'sha', msgtxt, opp.name, str(oppid)])
    prepend_comm(handler, prof, myprof,
                 [tstamp, 'shr', msgtxt, opp.name, str(oppid)])
    returnJSON(handler.response, [ myprof ])
    

def contact_request_email(handler, myprof, prof):
    if not is_friend(myprof, prof):
        handler.error(403)  # Forbidden
        handler.response.out.write("Must be co-workers or mutually listed.")
        return
    tstamp = nowISO()
    prepend_comm(handler, myprof, prof,
                 [tstamp, 'ema', msgtxt])
    prepend_comm(handler, prof, myprof,
                 [tstamp, 'emc', msgtxt])
    returnJSON(handler.response, [ myprof ])


def contact_respond_email(handler, myprof, prof):
    tstamp = nowISO()
    prepend_comm(handler, myprof, prof,
                 [tstamp, 'emr', msgtxt])
    prepend_comm(handler, prof, myprof,
                 [tstamp, 'emd', msgtxt])
    returnJSON(handler.response, [ myprof ])
    

def contact_ignore_all(handler, myprof, prof):
    # set client side filtering flag
    prepend_comm(handler, myprof, prof, [nowISO(), 'ign'])
    returnJSON(handler.response, [ myprof ])


def contact_ignore_nevermind(self, myprof, prof):
    # client side filtering flag override
    prepend_comm(handler, myprof, prof, [nowISO(), 'alw'])
    returnJSON(handler.response, [ myprof ])


def contact_remove_entry(self, myprof, prof):
    # completely remove the entry for the given profile from the contact book
    book = book_for_profile(myprof)
    profidstr = str(prof.key().id())
    entryindex = -1
    for index, entry in enumerate(book):
        if entry[1] == profidstr:
            entryindex = index
            break
    if index >= 0:
        del book[index]
        write_profile_book(myprof, book)
    returnJSON(handler.response, [ myprof ])
        

class ContactHandler(webapp2.RequestHandler):
    def post(self):
        myprof = profile.authprof(self)
        if not myprof:
            return
        code = self.request.get('code')
        msgtxt = self.request.get('msgtxt')
        profid = intz(self.request.get('profid'))
        oppid = intz(self.request.get('oppid'))
        wpid = intz(self.request.get('wpid'))
        prof = profile.Profile.get_by_id(profid)
        if not prof:
            self.error(412)  # Precondition Failed
            self.response.out.write("Profile " + profid + " not found")
            return
        if code == 'vol':
            return contact_volunteer_inquiry(self, myprof, prof, msgtxt, oppid)
        if code == 'wrk':
            return contact_work_done(self, myprof, prof, msgtxt, oppid, wpid)
        if code == 'a2b':
            return contact_add_to_book(self, myprof, prof)
        if code == 'sha':
            return contact_share_opportunity(self, myprof, prof, msgtxt, oppid)
        if code == 'ema':
            return contact_request_email(self, myprof, prof)
        if code == 'emr':
            return contact_respond_email(self, myprof, prof)
        if code == 'ign':
            return contact_ignore_all(self, myprof, prof)
        if code == 'alw':
            return contact_ignore_nevermind(self, myprof, prof)
        if code == 'rme':
            return contact_remove_entry(self, myprof, prof)
        if code == 'nop':  # loopback test for debugging
            return returnJSON(self.response, [ myprof ])
        self.error(412)  # Precondition Failed
        self.response.out.write("Unknown contact code " + code)


app = webapp2.WSGIApplication([('/contact', ContactHandler)
                               ], debug=True)
