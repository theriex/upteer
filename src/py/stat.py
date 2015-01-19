import webapp2
import datetime
from google.appengine.ext import db
import logging
from login import *
import profile
import opportunity
import work
import match

class StatPoint(db.Model):
    day = db.StringProperty(required=True)  # ISO date start of day
    daily = db.TextProperty();              # key:count CSV (logins, openopps)
    comms = db.TextProperty()               # code:count CSV


def get_stat_record(daystr):
    stat = None
    gql = StatPoint.gql("WHERE day=:1 LIMIT 1", daystr)
    stats = gql.fetch(1, read_policy=db.EVENTUAL_CONSISTENCY, deadline=10)
    if len(stats) > 0:
        stat = stats[0]
    else:
        stat = StatPoint(day=daystr)
        stat.comms = ""
    return stat


# Numerous calls to this function in quick succession could
# potentially cause some updates to be lost due to database lag.  Not
# critical, but important to not skew logical pairs of comms which is
# why this takes more than one code at once.
def bump_comm_count(codes):
    today = nowISO()[0:10] + "T00:00:00Z"
    stat = get_stat_record(today)
    for code in codes:
        ccs = csv_list(stat.comms)
        updated = False
        for cc in ccs:
            if cc.startswith(code):
                count = int(cc[4:])
                cc = code + ":" + str(count)
                updated = True
                break
        stat.comms = ",".join(ccs)
        if not updated:
            if stat.comms:
                stat.comms += ","
            stat.comms += code + ":1"
    stat.put()


def update_daily_counts(stat):
    gql = profile.Profile.gql("WHERE accessed > :1", stat.day)
    pcnt = gql.count(read_policy=db.EVENTUAL_CONSISTENCY)
    gql = opportunity.Opportunity.gql("WHERE status = 'Open'")
    ocnt = gql.count(read_policy=db.EVENTUAL_CONSISTENCY)
    gql = work.WorkPeriod.gql("WHERE status = 'Volunteering'")
    vcnt = gql.count(read_policy=db.EVENTUAL_CONSISTENCY)
    stat.daily = "logins:" + str(pcnt) +\
        ",opportunities:" + str(ocnt) +\
        ",volunteering:" + str(vcnt)


def send_mail_notice(devsys, profid, subj, text):
    prof = profile.Profile.get_by_id(profid)
    if not prof:
        logging.error("stat.py send_mail_notice profid " + str(profid) +
                      " not found. subj: " + subj + ", text: " + text)
        return
    logging.info("Mailed " + prof.email + " (" + prof.name + "): " + subj + 
                 " |>" + text)
    if not devsys:
        mail.send_mail(
                sender="Upteer Administrator <admin@upteer.com>",
                to=prof.email,
                subject=subj,
                body=text)


def expire_opportunities(devsys, daysback):
    gql = opportunity.Opportunity.gql("WHERE status = 'Open'")
    for opp in gql.run(read_policy=db.EVENTUAL_CONSISTENCY):
        msg = ""
        modified = opp.modified[0:10] + "T00:00:00Z"
        # logging.info(opp.name + " modified: " + modified)
        if modified <= daysback['28days']:
            opp.status = "Closed"
            opp.put()
            match.update_match_nodes("opportunity", opp.key().id(), 
                                     opp.skills, opp.skills, "Clear")
            msg = "$OPPNAME was not updated in 4 weeks and has been closed. If you are still looking for volunteers, feel free to create a new opportunity for volunteers to find."
        elif modified == daysback['27days']:
            msg = "$OPPNAME will be automatically closed tomorrow. If this opportunity is still open, please update it: $OPPURL"
        elif modified == daysback['25days']:
            msg = "$OPPNAME will expire in three days. If this opportunity is still open, please update it: $OPPURL"
        elif modified == daysback['21days']:
            msg = "To avoid having volunteers find old opportunities that are not longer valid, any opportunity that has not been touched in four weeks is automatically expired. $OPPNAME will expire in one week, so now would be a great time to verify the description is up to date. Any edit resets the expiration clock."
        if msg: # notify the opp contacts
            msg = msg.replace("$OPPNAME", opp.name)
            msg = msg.replace("$OPPURL", "https://www.upteer.com?")
            contacts = csv_list(opp.contact)
            for contact in contacts:
                send_mail_notice(devsys, int(contact), 
                                 opp.name + " expiration", msg)
    logging.info("stat.py expire_opportunities completed")


def auto_withdraw_inquiries():
    logging.info("stat.py auto_withdraw_inquiries not implemented yet")
    # letting an inquiry expire is not good. Follow up to avoid in future


def auto_done_work():
    logging.info("stat.py auto_done_work not implemented yet")


def auto_complete_work():
    logging.info("stat.py auto_complete_work not implemented yet")


def note_covolunteers():
    logging.info("stat.py note_covolunteers not implemented yet")


def expirations_and_monitoring(devsys):
    # logic here assumes this function is being called at most once daily.
    today = ISO2dt(nowISO()[0:10] + "T00:00:00Z")
    daysback = { '1day': dt2ISO(today - datetime.timedelta(1)),
                 '2days': dt2ISO(today - datetime.timedelta(2)),
                 '3days': dt2ISO(today - datetime.timedelta(3)),
                 '7days': dt2ISO(today - datetime.timedelta(7)),
                 '21days': dt2ISO(today - datetime.timedelta(21)),
                 '25days': dt2ISO(today - datetime.timedelta(25)),
                 '27days': dt2ISO(today - datetime.timedelta(27)),
                 '28days': dt2ISO(today - datetime.timedelta(28)) }
    # logging.info("      1day: " + daysback['1day'])
    # logging.info("     2days: " + daysback['2days'])
    # logging.info("     3days: " + daysback['3days'])
    # logging.info("     7days: " + daysback['7days'])
    # logging.info("    21days: " + daysback['21days'])
    # logging.info("    25days: " + daysback['25days'])
    # logging.info("    27days: " + daysback['27days'])
    # logging.info("    28days: " + daysback['28days'])
    expire_opportunities(devsys, daysback)
    auto_withdraw_inquiries()
    auto_done_work()
    auto_complete_work()
    note_covolunteers()


class ComputeDailyStats(webapp2.RequestHandler):
    def get(self):
        yesterday = dt2ISO(datetime.datetime.utcnow() - datetime.timedelta(1))
        yesterday = yesterday[0:10] + "T00:00:00Z"
        stat = get_stat_record(yesterday)
        update_daily_counts(stat)
        stat.put()
        msg = "ComputeDailyStats updated stats for " + stat.day[0:10] +\
            ". daily: " + stat.daily +\
            " comms: " + stat.comms
        logging.info(msg)
        devsys = self.request.url.startswith('http://localhost')
        if devsys:
            self.response.out.write(msg)
        expirations_and_monitoring(devsys)


class FetchDailyStats(webapp2.RequestHandler):
    def get(self):
        cutoff = dt2ISO(datetime.datetime.utcnow() - datetime.timedelta(200))
        cutoff = cutoff[0:10] + "T00:00:00Z"
        gql = StatPoint.gql("WHERE day >= :1", cutoff)
        stats = gql.fetch(200, read_policy=db.EVENTUAL_CONSISTENCY, deadline=10)
        returnJSON(self.response, stats)


app = webapp2.WSGIApplication([('/daystats', ComputeDailyStats),
                               ('/fetchdaystats', FetchDailyStats)
                               ], debug=True)

