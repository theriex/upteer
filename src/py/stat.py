import webapp2
import datetime
from google.appengine.ext import db
import logging
from login import *
import profile
import opportunity
import work

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
        if self.request.url.startswith('http://localhost'):
            self.response.out.write(msg)


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

