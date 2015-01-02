import webapp2
import datetime
from google.appengine.ext import db
import logging
import urllib
import json
from login import *
import profile
import organization
import opportunity

# The intent of a WorkPeriod is to facilitate the contact process,
# track hours being volunteered, and make it cool to see all the work
# getting done by all these wonderful people and organizations.  The
# expectation is that the site work tracking will serve as the primary
# tracking system for most volunteers and some smaller organizations.
# The WorkPeriod does NOT encompass scheduling.  Volunteers have their
# own ways of keeping track of where they should be when, and
# coordinators have their own ways of tracking who will be showing up
# when.  If they don't, and they need it, then we recommend setting
# up a Google calendar for each opportunity they are coordinating.
#
# Work hours are filled out by the volunteer (with calc help) based on
# the specified tracking interval, but they are subject to approval by
# the coordinator.  At the longest, things are rectified monthly
# (can't let things float for too long).  The coordinator has up to 18
# days to modify Done work, after that it is automatically marked as
# Completed.  Completed work cannot be modified.
# status:
#   Inquiring (vol): Set on inquiry, 0 hrs
#   Responded (coord): Optionally set on initial response
#   Withdrawn (vol): Offer didn't work out, 0 hrs
#   Canceled (coord): Opportunity didn't work out, 0 hrs
#   Volunteering (vol): Start date set, hours filled in
#   Done (vol): Completed but not approved yet.
#   No Show (coord): 0 hrs
#   Completed (coord/site): Satisfactory completion, hours as specified
#
# The oppname and volname fields are set when the WorkPeriod is
# initially created.  They are not updated if the Opportunity or
# Profile name changes after the work is completed.
#

class WorkPeriod(db.Model):
    volunteer = db.IntegerProperty(required=True)   # ID of volunteer
    opportunity = db.IntegerProperty(required=True) # ID of opportunity
    tracking = db.StringProperty(required=True)     # Daily, Weekly, Monthly
    modified = db.StringProperty()        # ISO date
    oppname = db.StringProperty(indexed=False)      # orgname + " " + oppname
    volname = db.StringProperty(indexed=False)      # volunteer.name
    start = db.StringProperty()           # ISO date
    done = db.StringProperty()            # ISO date
    status = db.StringProperty()          # Volunteering, Completed etc
    visibility = db.IntegerProperty()     # 1: vol, 2: vol/coord, 3: world
    hours = db.IntegerProperty()          # Total hours volunteered
    volshout = db.TextProperty()          # Volunteer notes to the world
    coordshout = db.TextProperty()        # Coordinator notes to the world


def book_for_profile(prof):
    book = []
    if prof.book:
        book = json.loads(prof.book)
    return book


def write_profile_book(prof, book):
    prof.book = json.dumps(book)
    logging.info("write_profile_book: " + prof.book)
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
    retentions = { 'mvi': 1, 'tvi': 3,   # volunteering inquiry
                   'mvw': 3, 'tvw': 3,   # inquiry withdrawal
                   'mwu': 1,             # work update
                   'mwd': 1, 'twd': 3,   # work done (vol)
                   'mvf': 3, 'tvf': 3,   # inquiry refusal
                   'mvy': 1, 'tvy': 3,   # inquiry response
                   'mwc': 3, 'twc': 3,   # work complete (coord)
                   'mor': 3, 'tor': 3,   # opportunity review
                   'mvr': 3, 'tvr': 3,   # volunteer review
                   'msh': 5, 'tsh': 20,  # opportunity share
                   'msd': 3,             # opportunity share dismiss
                   'mab': 1, 'tab': 1,   # contact book add
                   'mci': 1, 'tci': 1,   # email address request
                   'mcg': 1,             # email address refusal
                   'mcr': 1, 'tcr': 1,   # email address response
                   'cov': 20 }           # co-workers at an opportunity
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
    if code in ['tvi', 'tvy', 'tsh', 'tci', 'tcr']:
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
    if entry and ((most_recent_comm(entry, "mab") and
                   most_recent_comm(entry, "tab")) or
                  most_recent_comm(entry, "cov")):
        return True
    return False


def is_opp_contact(prof, opp):
    if str(prof.key().id()) in csv_list(opp.contact):
        return True
    return False


def find_opp(handler, oppid):
    opp = opportunity.Opportunity.get_by_id(oppid)
    if not opp:
        handler.error(412)  # Precondition Failed
        handler.response.out.write("Opportunity " + oppid + " not found")
        return
    return opp


def verify_opp(handler, prof, oppid):
    opp = find_opp(handler, oppid)
    if not opp:
        return
    if not is_opp_contact(prof, opp):
        handler.error(412)  # Precondition Failed
        handler.response.out.write(prof.name + " not contact for " + opp.name)
        return
    return opp


def find_work_period(handler, prof, opp, wpid):
    wp = WorkPeriod.get_by_id(wpid)
    if not wp:
        handler.error(412)  # Precondition Failed
        handler.response.out.write("WorkPeriod " + wpid + " not found")
        return
    if wp.opportunity != opp.key().id():
        handler.error(412)  # Precondition Failed
        handler.response.out.write("WorkPeriod does not match opportunity")
        return
    isvol = wp.volunteer == prof.key().id()
    iscoord = is_opp_contact(prof, opp)
    if not isvol and not iscoord:
        handler.error(403)  # Forbidden
        handler.response.out.write("Not volunteer or coordinator.")
        return
    return wp


def verify_work_period(handler, prof, opp, wpid):
    wp = find_work_period(handler, wpid)
    if not wp:
        return
    errmsg = "WorkPeriod status " + wp.status + " may not be modified"
    if wp.volunteer == prof.key().id():
        if wp.status == "Inquiring" or wp.status == "Responded" or\
                wp.status == "Volunteering":
            return wp
    if is_opp_contact(prof, opp):
        if wp.status == "Inquiring":
            return wp
        if wp.status == "Done" or wp.status == "No Show" or\
                wp.status == "Completed":
            if not wp.done:  # verify completion date set
                wp.done = dt2ISO(datetime.datetime.utcnow())
            daymok = dt2ISO(datetime.datetime.utcnow() - datetime.timedelta(15))
            if wp.done and daymok < wp.done:
                return wp
            else:
                errmsg = "WorkPeriod status " + wp.status +\
                    " may no longer be modified"
    handler.error(403)  # Forbidden
    handler.response.out.write(errmsg)


def read_general_wp_values(handler, wp):
    wp.tracking = handler.request.get("tracking")
    wp.start = handler.request.get('start')
    if handler.request.get('hours'):
        wp.hours = intz(handler.request.get('hours'))


def get_contact_receiver(handler):
    profid = intz(handler.request.get('profid'))
    if not profid:
        handler.error(412)  # Precondition Failed
        handler.response.out.write("No receiver profid given")
        return
    prof = profile.Profile.get_by_id(profid)
    if not prof:
        handler.error(412)  # Precondition Failed
        handler.response.out.write("Receiver profile " + profid + " not found")
        return
    return prof


def contact_volunteer_inquiry(handler, myprof):
    # Preventing creation of a second inquiry is only checked
    # client-side for now.
    prof = get_contact_receiver(handler)
    if not prof:
        return
    oppid = intz(handler.request.get('oppid'))
    opp = verify_opp(handler, prof, oppid)
    if not opp:
        return
    org = organization.Organization.get_by_id(opp.organization)
    tstamp = nowISO()
    msgtxt = handler.request.get('msgtxt')
    wp = WorkPeriod(volunteer=myprof.key().id(), opportunity=oppid,
                    tracking="Weekly")
    read_general_wp_values(handler, wp)
    wp.modified = tstamp
    wp.status = "Inquiring"
    wp.visibility = 2
    wp.oppname = org.name + " " + opp.name
    wp.volname = myprof.name
    wp.put()
    wpid = wp.key().id()
    prepend_comm(handler, myprof, prof, 
                 [tstamp, 'mvi', msgtxt, wp.oppname, str(oppid), str(wpid)])
    prepend_comm(handler, prof, myprof,
                 [tstamp, 'tvi', msgtxt, wp.oppname, str(oppid), str(wpid)])
    returnJSON(handler.response, [ myprof, wp ])


def contact_inquiry_withdrawal(handler, myprof):
    prof = get_contact_receiver(handler)
    if not prof:
        return
    oppid = intz(handler.request.get('oppid'))
    opp = verify_opp(handler, prof, oppid)
    if not opp:
        return
    wpid = intz(handler.request.get('wpid'))
    wp = verify_work_period(handler, myprof, opp, wpid)
    if not wp:
        return
    tstamp = nowISO()
    wp.modified = tstamp
    wp.status = "Withdrawn"
    wp.visibility = 1
    wp.put()
    prepend_comm(handler, myprof, prof,
                 [tstamp, 'mvw', "", wp.oppname, str(oppid), str(wpid)])
    prepend_comm(handler, prof, myprof,
                 [tstamp, 'tvw', "", wp.oppname, str(oppid), str(wpid)])
    returnJSON(handler.response, [ myprof, wp ])


def contact_work_update(handler, myprof):
    prof = get_contact_receiver(handler)
    if not prof:
        return
    oppid = intz(handler.request.get('oppid'))
    opp = verify_opp(handler, prof, oppid)
    if not opp:
        return
    wpid = intz(handler.request.get('wpid'))
    wp = verify_work_period(handler, myprof, opp, wpid)
    if not wp:
        return
    if wp.status != "Inquiring" and wp.status != "Responded" and\
            wp.status != "Volunteering":
        handler.error(412)  # Precondition Failed
        handler.response.out.write("Work Period status " + wp.status +\
                                    " may not be updated.")
        return
    tstamp = nowISO()
    read_general_wp_values(handler, wp)
    wp.modified = tstamp
    wp.status = "Volunteering"
    wp.visibility = 2
    wp.put()
    prepend_comm(handler, myprof, prof,
                 [tstamp, 'mwu', "", wp.oppname, str(oppid), str(wpid)])
    returnJSON(handler.response, [ myprof, wp ])
    

def contact_work_done(handler, myprof):
    prof = get_contact_receiver(handler)
    if not prof:
        return
    oppid = intz(handler.request.get('oppid'))
    opp = verify_opp(handler, prof, oppid)
    if not opp:
        return
    wpid = intz(handler.request.get('wpid'))
    wp = verify_work_period(handler, myprof, opp, wpid)
    if not wp:
        return
    tstamp = nowISO()
    read_general_wp_values(handler, wp)
    wp.modified = tstamp
    wp.done = tstamp
    wp.status = "Done"
    wp.visibility = 3
    wp.put()
    msgtxt = handler.request.get('msgtxt') or ""
    prepend_comm(handler, myprof, prof,
                 [tstamp, 'mwd', msgtxt, wp.oppname, str(oppid), str(wpid)])
    prepend_comm(handler, prof, myprof,
                 [tstamp, 'twd', msgtxt, wp.oppname, str(oppid), str(wpid)])
    returnJSON(handler.response, [ myprof, wp ])


def contact_inquiry_refusal(handler, myprof):
    prof = get_contact_receiver(handler)
    if not prof:
        return
    oppid = intz(handler.request.get('oppid'))
    opp = verify_opp(handler, myprof, oppid)
    if not opp:
        return
    wpid = intz(handler.request.get('wpid'))
    wp = verify_work_period(handler, prof, opp, wpid)
    if not wp:
        return
    tstamp = nowISO()
    read_general_wp_values(handler, wp)
    wp.modified = tstamp
    # leave wp.status as it was. They can withdraw, or auto-withdraw does it
    wp.put()
    msgtxt = handler.request.get('msgtxt') or ""
    prepend_comm(handler, myprof, prof,
                 [tstamp, 'mvf', msgtxt, wp.oppname, str(oppid), str(wpid)])
    prepend_comm(handler, prof, myprof,
                 [tstamp, 'tvf', msgtxt, wp.oppname, str(oppid), str(wpid)])
    returnJSON(handler.response, [ myprof, wp ])


def contact_inquiry_response(handler, myprof):
    prof = get_contact_receiver(handler)
    if not prof:
        return
    oppid = intz(handler.request.get('oppid'))
    opp = verify_opp(handler, myprof, oppid)
    if not opp:
        return
    wpid = intz(handler.request.get('wpid'))
    wp = verify_work_period(handler, prof, opp, wpid)
    if not wp:
        return
    tstamp = nowISO()
    read_general_wp_values(handler, wp)
    wp.modified = tstamp
    wp.status = "Responded"
    wp.visibility = 2
    wp.put()
    msgtxt = handler.request.get('msgtxt') or ""
    prepend_comm(handler, myprof, prof,
                 [tstamp, 'mvy', msgtxt, wp.oppname, str(oppid), str(wpid)])
    prepend_comm(handler, prof, myprof,
                 [tstamp, 'tvy', msgtxt, wp.oppname, str(oppid), str(wpid)])
    returnJSON(handler.response, [ myprof, wp ])


def contact_add_to_book(handler, myprof):
    prof = get_contact_receiver(handler)
    if not prof:
        return
    tstamp = nowISO()
    prepend_comm(handler, myprof, prof, [tstamp, 'mab', ""])
    prepend_comm(handler, prof, myprof, [tstamp, 'tab', ""])
    returnJSON(handler.response, [ myprof ])


def contact_work_complete(handler, myprof):
    prof = get_contact_receiver(handler)
    if not prof:
        return
    oppid = intz(handler.request.get('oppid'))
    opp = verify_opp(handler, myprof, oppid)
    if not opp:
        return
    wpid = intz(handler.request.get('wpid'))
    wp = verify_work_period(handler, myprof, opp, wpid)
    if not wp:
        return
    tstamp = nowISO()
    read_general_wp_values(handler, wp)
    wp.modified = tstamp
    wp.status = "Completed"
    if not wp.hours:
        wp.status = "No Show"
    wp.visibility = 3
    wp.put()
    msgtxt = handler.request.get('msgtxt') or ""
    prepend_comm(handler, myprof, prof,
                 [tstamp, 'mwc', msgtxt, wp.oppname, str(oppid), str(wpid)])
    prepend_comm(handler, prof, myprof,
                 [tstamp, 'twc', msgtxt, wp.oppname, str(oppid), str(wpid)])
    returnJSON(handler.response, [ myprof, wp ])


def contact_opportunity_review(handler, myprof):
    prof = get_contact_receiver(handler)
    if not prof:
        return
    oppid = intz(handler.request.get('oppid'))
    opp = verify_opp(handler, prof, oppid)
    if not opp:
        return
    wpid = intz(handler.request.get('wpid'))
    wp = find_work_period(handler, myprof, opp, wpid)
    if not wp:
        return
    tstamp = nowISO()
    wp.modified = tstamp
    msgtxt = handler.request.get('msgtxt') or ""
    wp.coordshout = msgtxt
    wp.put()
    prepend_comm(handler, myprof, prof,
                 [tstamp, 'mor', msgtxt, wp.oppname, str(oppid), str(wpid)])
    prepend_comm(handler, prof, myprof,
                 [tstamp, 'tor', msgtxt, wp.oppname, str(oppid), str(wpid)])
    returnJSON(handler.response, [ myprof, wp ])


def contact_volunteer_review(handler, myprof):
    prof = get_contact_receiver(handler)
    if not prof:
        return
    oppid = intz(handler.request.get('oppid'))
    opp = verify_opp(handler, myprof, oppid)
    if not opp:
        return
    wpid = intz(handler.request.get('wpid'))
    wp = find_work_period(handler, prof, opp, wpid)
    if not wp:
        return
    tstamp = nowISO()
    wp.modified = tstamp
    msgtxt = handler.request.get('msgtxt') or ""
    wp.volshout = msgtxt
    wp.put()
    prepend_comm(handler, myprof, prof,
                 [tstamp, 'mvr', msgtxt, wp.oppname, str(oppid), str(wpid)])
    prepend_comm(handler, prof, myprof,
                 [tstamp, 'tvr', msgtxt, wp.oppname, str(oppid), str(wpid)])
    returnJSON(handler.response, [ myprof, wp ])


def contact_share_opportunity(handler, myprof):
    # Preventing repeated sharing of the same opportunity with the
    # same person is only checked client side for now.
    prof = get_contact_receiver(handler)
    if not prof:
        return
    oppid = intz(handler.request.get('oppid'))
    opp = find_opp(handler, oppid)
    if not opp:
        return
    if not is_opp_contact(myprof, opp) and not is_friend(myprof, prof):
        handler.error(403)  # Forbidden
        handler.response.out.write("Must be a coordinator or friend to share.")
        return
    org = organization.Organization.get_by_id(opp.organization)
    oppname = org.name + " " + opp.name
    tstamp = nowISO()
    msgtxt = handler.request.get('msgtxt') or ""
    prepend_comm(handler, myprof, prof,
                 [tstamp, 'msh', msgtxt, oppname, str(oppid)])
    prepend_comm(handler, prof, myprof,
                 [tstamp, 'tsh', msgtxt, oppname, str(oppid)])
    returnJSON(handler.response, [ myprof ])
    

def contact_dismiss_share(handler, myprof):
    prof = get_contact_receiver(handler)
    if not prof:
        return
    tstamp = nowISO()
    prepend_comm(handler, myprof, prof,
                 [tstamp, 'msd', ""])
    returnJSON(handler.response, [ myprof ])


def contact_request_email(handler, myprof):
    prof = get_contact_receiver(handler)
    if not prof:
        return
    if not is_friend(myprof, prof):
        handler.error(403)  # Forbidden
        handler.response.out.write("Must be co-workers or mutually listed.")
        return
    tstamp = nowISO()
    msgtxt = handler.request.get('msgtxt') or ""
    prepend_comm(handler, myprof, prof,
                 [tstamp, 'mci', msgtxt])
    prepend_comm(handler, prof, myprof,
                 [tstamp, 'tci', msgtxt])
    returnJSON(handler.response, [ myprof ])


def contact_ignore_email(handler, myprof):
    prof = get_contact_receiver(handler)
    if not prof:
        return
    tstamp = nowISO()
    prepend_comm(handler, myprof, prof,
                 [tstamp, 'mcr', ""])
    returnJSON(handler.response, [ myprof ])


def contact_respond_email(handler, myprof):
    prof = get_contact_receiver(handler)
    if not prof:
        return
    tstamp = nowISO()
    msgtxt = handler.request.get('msgtxt') or ""
    prepend_comm(handler, myprof, prof,
                 [tstamp, 'mcr', msgtxt])
    prepend_comm(handler, prof, myprof,
                 [tstamp, 'tcr', msgtxt])
    returnJSON(handler.response, [ myprof ])
    

def contact_remove_entry(handler, myprof):
    # completely remove the entry for the given profile from the contact book
    prof = get_contact_receiver(handler)
    if not prof:
        return
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
        if code == 'mvi':
            return contact_volunteer_inquiry(self, myprof)
        if code == 'mvw':
            return contact_inquiry_withdrawal(self, myprof)
        if code == 'mwu':
            return contact_work_update(self, myprof)
        if code == 'mwd':
            return contact_work_done(self, myprof)
        if code == 'mvf':
            return contact_inquiry_refusal(self, myprof)
        if code == 'mvy':
            return contact_inquiry_response(self, myprof)
        if code == 'mab':
            return contact_add_to_book(self, myprof)
        if code == 'mwc':
            return contact_work_complete(self, myprof)
        if code == 'mor':
            return contact_opportunity_review(self, myprof)
        if code == 'mvr':
            return contact_volunteer_review(self, myprof)
        if code == 'msh':
            return contact_share_opportunity(self, myprof)
        if code == 'msd':
            return contact_dismiss_share(self, myprof)
        if code == 'mci':
            return contact_request_email(self, myprof)
        if code == 'mcg':
            return contact_ignore_email(self, myprof)
        if code == 'mcr':
            return contact_respond_email(self, myprof)
        if code == 'rme':  # extension message for book cleanup if needed
            return contact_remove_entry(self, myprof, prof)
        if code == 'nop':  # loopback test for debugging
            return returnJSON(self.response, [ myprof ])
        self.error(412)  # Precondition Failed
        self.response.out.write("Unknown contact code " + code)


class FetchWork(webapp2.RequestHandler):
    def get(self):
        myprof = profile.authprof(self)
        if not myprof:
            return
        where = ""
        fetchmax = 0
        searchid = intz(self.request.get('profid'))
        if searchid and searchid == myprof.key().id():
            where = "WHERE volunteer = :1 "
            fetchmax = 50
        elif searchid:  # someone else's profile
            where = "WHERE volunteer = :1 AND visibility >= 3"
            fetchmax = 10
        else:
            searchid = intz(self.request.get('oppid'))
            opp = opportunity.Opportunity.get_by_id(searchid)
            if is_opp_contact(myprof, opp):
                where = "WHERE opportunity = :1"
                fetchmax = 50
            elif searchid:  # just viewing an opportunity
                where = "WHERE opportunity = :1 AND visibility >= 3"
                fetchmax = 20
        if not where:
            self.error(412)  # Precondition Failed
            self.response.out.write("No profid or oppid given")
        gql = WorkPeriod.gql(where, searchid)
        wps = gql.fetch(fetchmax, read_policy=db.EVENTUAL_CONSISTENCY,
                        deadline=10)
        returnJSON(self.response, wps)


class WorkPeriodById(webapp2.RequestHandler):
    def get(self):
        wpid = self.request.get('wpid')
        wp = WorkPeriod.get_by_id(intz(wpid))
        if not wp:
            self.error(404)  # Not Found
            self.response.out.write("No WorkPeriod found with id: " + wpid)
            return
        # WorkPeriod data is not considered sensitive enough to warrant 
        # authorization overhead when retrieving by id.  If that changes
        # then authorize or filter before returning...
        returnJSON(self.response, [ wp ])


app = webapp2.WSGIApplication([('/contact', ContactHandler),
                               ('/fetchwork', FetchWork),
                               ('/wpbyid', WorkPeriodById)
                               ], debug=True)
