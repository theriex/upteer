import webapp2
import datetime
from google.appengine.ext import db
import logging
from login import *
import profile
import opportunity

class StatPoint(db.Model):
    day = db.StringProperty(required=True)  # ISO date start of day
    daily = db.TextProperty();              # key:count CSV (logins, openopps)
    comms = db.TextProperty()               # code:count CSV


def update_daily_counts(stat):
    gql = profile.Profile.gql("WHERE accessed > :1", stat.day)
    pcnt = gql.count(read_policy=db.EVENTUAL_CONSISTENCY)
    gql = opportunity.Opportunity.gql("WHERE status = 'Open'")
    ocnt = gql.count(read_policy=db.EVENTUAL_CONSISTENCY)
    stat.daily = "logins:" + str(pcnt) + ",opportunities:" + str(ocnt)


class ComputeDailyStats(webapp2.RequestHandler):
    def get(self):
        yesterday = dt2ISO(datetime.datetime.utcnow() - datetime.timedelta(1))
        yesterday = yesterday[0:10] + "T00:00:00Z"
        stat = None
        gql = StatPoint.gql("WHERE day=:1 LIMIT 1", yesterday)
        stats = gql.fetch(1, read_policy=db.EVENTUAL_CONSISTENCY, deadline=10)
        if len(stats) > 0:
            stat = stats[0]
        else:
            stat = StatPoint(day=yesterday)
            stat.comms = ""
        update_daily_counts(stat)
        msg = "ComputeDailyStats updated stats for " + stat.day[0:10] +\
            ". daily: " + stat.daily +\
            " comms: " + stat.comms
        logging.info(msg)
        if self.request.url.startswith('http://localhost'):
            self.response.out.write(msg)


app = webapp2.WSGIApplication([('/daystats', ComputeDailyStats)
                               ], debug=True)

