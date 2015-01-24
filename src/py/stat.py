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
    email = ""
    emfull = ""
    if "@" in str(profid):
        email = profid
        emfull = email
    else:
        prof = profile.Profile.get_by_id(int(profid))
        if not prof:
            logging.error("stat.py send_mail_notice profid " + str(profid) +
                          " not found. subj: " + subj + ", text: " + text)
            return
        email = prof.email
        emfull = prof.email + " (" + prof.name + ")"
    logging.info("Mailed " + emfull + ": " + subj + " |>" + text)
    if not devsys:
        mail.send_mail(
                sender="Upteer Administrator <admin@upteer.com>",
                to=prof.email,
                subject=subj,
                body=text)


def replace_text_and_email_recipients(devsys, subj, msg, dolldict, ridcsv):
    for dollarkey in dolldict.iterkeys():
        msg = msg.replace(dollarkey, dolldict[dollarkey])
    recipients = csv_list(str(ridcsv))
    for recipient in recipients:
        send_mail_notice(devsys, recipient, subj, msg)


def notify_opp_contacts(subj, msg, opp):
    siteurl = "https://www.upteer.com"
    oppurl = siteurl + "?view=opp&oppid=" + str(opp.key().id())
    msg = msg.replace("$SITEURL", siteurl)
    msg = msg.replace("$OPPNAME", opp.name)
    msg = msg.replace("$OPPURL", oppurl)


def expire_opportunities(devsys, daysback):
    gql = opportunity.Opportunity.gql("WHERE status = 'Open'")
    for opp in gql.run(read_policy=db.EVENTUAL_CONSISTENCY):
        msg = ""
        modified = opp.modified[0:10] + "T00:00:00Z"
        if modified <= daysback['28days']:
            opp.status = "Closed"
            # not updating modified, leaving for the record
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
        if msg:
            siteurl = "https://www.upteer.com"
            oppurl = siteurl + "?view=opp&oppid=" + str(opp.key().id())
            dolldict = { '$OPPNAME': opp.name,
                         '$OPPURL': oppurl }
            replace_text_and_email_recipients(devsys, 
                                              opp.name + " expiration",
                                              msg, dolldict, opp.contact)
    logging.info("stat.py expire_opportunities completed")


def expire_inquiries(devsys, daysback):
    gql = work.WorkPeriod.gql("WHERE status = 'Inquiring'")
    for wp in gql.run(read_policy=db.EVENTUAL_CONSISTENCY):
        cmsg = ""
        vmsg = ""
        amsg = ""
        modified = wp.modified[0:10] + "T00:00:00Z"
        if modified <= daysback['12days']:
            wp.status = "Expired"
            # not updating modified, leaving for the record
            wp.put()
            cmsg = "The volunteering inquiry from $VOLNAME for $OPPNAME has expired. The inquiry had been outstanding for 12 days which is a long time to wait to hear back. If you are not looking for volunteers, please switch the opportunity to inactive or close it. If you are not interested in a particular volunteer, you can refuse their inquiry. If there is anything else we can do to improve the communication process, please let us know by replying to this message."
            vmsg = "Your inquiry for $OPPNAME has expired. Not getting a response back is hard, the Upteer crew is doing what they can to prevent dropped communications like this. You can create a new inquiry if you want to volunteer again, either with this group or another one."
            amsg = cmsg
        elif modified == daysback['11days']:
            cmsg = "The volunteering inquiry from $VOLNAME for $OPPNAME has been outstanding for 11 days and will automatically expire tomorrow. If you are not looking for help, refusing the inquiry and providing a short message why might be appreciated: $VOLURL"
        elif modified == daysback['7days']:
            cmsg = "A volunteering inquiry for $OPPNAME has been outstanding for a week now and $VOLNAME would probably appreciate either a response (if they might be able to help out) or a refusal (if you don't need their help): $VOLURL"
            vmsg = "Your inquiry for $OPPNAME has been outstanding for a week now. Upteer has sent a reminder message to the contact to try and move things along. Meanwhile if you've heard back from them by email directly, please update the work status so things get tracked properly: $SITEURL"
        if cmsg or vmsg:
            opp = opportunity.Opportunity.get_by_id(wp.opportunity)
            if not opp:
                logging.error("expire_inquiries bad oppid " + wp.opportunity)
                continue
            siteurl = "https://www.upteer.com"
            volurl = siteurl + "?view=profile&profid=" + str(wp.volunteer)
            dolldict = { '$VOLNAME': wp.volname,
                         '$OPPNAME': wp.oppname,
                         '$VOLURL': volurl,
                         '$SITEURL': siteurl }
            subj = "Outstanding volunteer inquiry"
            if cmsg:
                replace_text_and_email_recipients(devsys, subj, cmsg, dolldict,
                                                  opp.contact)
            if vmsg:
                replace_text_and_email_recipients(devsys, subj, vmsg, dolldict,
                                                  wp.volunteer)
            if amsg:
                replace_text_and_email_recipients(devsys, subj, amsg, dolldict,
                                                  "admin@upteer.com")
    logging.info("stat.py expire_inquiries completed")


def drop_responses(devsys, daysback):
    gql = work.WorkPeriod.gql("WHERE status = 'Responded'")
    for wp in gql.run(read_policy=db.EVENTUAL_CONSISTENCY):
        vmsg = ""
        modified = wp.modified[0:10] + "T00:00:00Z"
        if modified <= daysback['12days']:
            wp.status = "Dropped"
            # not updating modified, leaving for the record
            wp.put()
            vmsg = "Your volunteering inquiry for $OPPNAME has been dropped. It had been 12 days since you received a response and you did not withdraw your offer or start work."
        elif modified == daysback['11days']:
            vmsg = "Your volunteering inquiry for $OPPNAME will be dropped tomorrow. Please withdraw your offer or note when you are starting work: $SITEURL"
        elif modified == daysback['7days']:
            vmsg = "It has been a week since you received a response about volunteering for $OPPNAME. If you are volunteering, please fill in a start date when you will begin work, you can change the date later if needed.  If you are not volunteering, please withdraw your offer so things are tracked properly: $SITEURL"
        if vmsg:
            siteurl = "https://www.upteer.com"
            dolldict = { '$OPPNAME': wp.oppname,
                         '$SITEURL': siteurl }
            subj = "Outstanding inquiry response"
            replace_text_and_email_recipients(devsys, subj, vmsg, dolldict,
                                              wp.volunteer)
    logging.info("stat.py drop_responses completed")


def auto_done_work(devsys, daysback):
    gql = work.WorkPeriod.gql("WHERE status = 'Volunteering'")
    for wp in gql.run(read_policy=db.EVENTUAL_CONSISTENCY):
        vmsg = ""
        days = 14  # default is "2 Weeks" duration
        if wp.duration == "1 Day":
            days = 1
        elif wp.duration == "1 Week":
            days = 7
        elif wp.duration == "4 Weeks":
            days = 28
        else: # default is "2 Weeks", verify duration value is set
            wp.duration = "2 Weeks"
        done = dt2ISO(ISO2dt(wp.start[0:10] + "T00:00:00Z") + 
                      datetime.timedelta(days))
        if done <= daysback['5days']:
            logging.info("Ongoing work " + str(wp.oppname) + " by " + str(wp.volname) +  " done: " + done)
            wp.modified = nowISO()  # auto-complete works off modified time
            vprof = profile.Profile.get_by_id(wp.volunteer)
            opp = opportunity.Opportunity.get_by_id(wp.opportunity)
            cprof = profile.Profile.get_by_id(int(csv_list(opp.contact)[0]))
            oppidstr = str(opp.key().id())
            work.write_done_work(devsys, wp, done, vprof, cprof, "", oppidstr)
            vmsg = "Your volunteering work for $OPPNAME has been marked as done. To continue tracking your contributions, ask to volunteer again."
        elif done == daysback['3days']:
            vmsg = "After tomorrow, your volunteering work for $OPPNAME will be automatically marked as done and the coordinator will have an opportunity to verify your hours. Please check that your hours, start date and duration are correct: $SITEURL"
        elif done == daysback['1day']:
            vmsg = "Your volunteering work for $OPPNAME has completed. Please verify the hours, start, and duration values are correct so your work is properly reflected in your profile: $SITEURL"
        if vmsg:
            siteurl = "https://www.upteer.com"
            dolldict = { '$OPPNAME': wp.oppname,
                         '$SITEURL': siteurl }
            subj = "Completed volunteer work"
            replace_text_and_email_recipients(devsys, subj, vmsg, dolldict,
                                              wp.volunteer)
    logging.info("stat.py auto_done_work completed")


def auto_complete_work(devsys, daysback):
    gql = work.WorkPeriod.gql("WHERE status = 'Done'")
    for wp in gql.run(read_policy=db.EVENTUAL_CONSISTENCY):
        cmsg = ""
        modified = wp.modified[0:10] + "T00:00:00Z"
        if modified <= daysback['5days']:
            logging.info("Ongoing work " + str(wp.oppname) + " by " + str(wp.volname) +  " completed: " + modified)
            wp.status = "Completed"
            # not updating modified, leaving for the record
            wp.put()
            # no message. No unexpected changes
            work.note_covolunteers(devsys, wp)
        elif modified == daysback['1day']:
            cmsg = "$VOLNAME has volunteered $HOURS hours for $OPPNAME in the past $DURATION. This work period will automatically be marked as completed after 5 days. If the hours are incorrect, please adjust as needed: $VOLURL"
        if cmsg:
            opp = opportunity.Opportunity.get_by_id(wp.opportunity)
            if not opp:
                logging.error("expire_inquiries bad oppid " + wp.opportunity)
                continue
            siteurl = "https://www.upteer.com"
            volurl = siteurl + "?view=profile&profid=" + str(wp.volunteer)
            dolldict = { '$VOLNAME': wp.volname,
                         '$HOURS': str(wp.hours),
                         '$OPPNAME': wp.oppname,
                         '$DURATION': wp.duration,
                         '$VOLURL': volurl }
            subj = "Completed volunteer hours"
            replace_text_and_email_recipients(devsys, subj, cmsg, dolldict,
                                              opp.contact)
    logging.info("stat.py auto_complete_work completed")


def expirations_and_monitoring(devsys):
    # logic here assumes this function is being called at most once daily.
    today = ISO2dt(nowISO()[0:10] + "T00:00:00Z")
    daysback = { '1day': dt2ISO(today - datetime.timedelta(1)),
                 '3days': dt2ISO(today - datetime.timedelta(3)),
                 '5days': dt2ISO(today - datetime.timedelta(5)),
                 '7days': dt2ISO(today - datetime.timedelta(7)),
                 '11days': dt2ISO(today - datetime.timedelta(11)),
                 '12days': dt2ISO(today - datetime.timedelta(12)),
                 '21days': dt2ISO(today - datetime.timedelta(21)),
                 '25days': dt2ISO(today - datetime.timedelta(25)),
                 '27days': dt2ISO(today - datetime.timedelta(27)),
                 '28days': dt2ISO(today - datetime.timedelta(28)) }
    for dkey in sorted(daysback.iterkeys(), 
                       key=(lambda x: int(re.search(r'\d+', x).group()))):
        logging.info('{:>12}'.format(dkey) + ": " + daysback[dkey])
    expire_opportunities(devsys, daysback)
    expire_inquiries(devsys, daysback)
    drop_responses(devsys, daysback)
    auto_done_work(devsys, daysback)
    auto_complete_work(devsys, daysback)


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

