import webapp2
import datetime
from google.appengine.ext import db
import logging
from login import *
import profile


# A single keyword may not contain a comma.
class Node(db.Model):
    """ A match network computed point """
    # The canonical name is used as the key. No separate name_c field
    name = db.StringProperty(required=True)     # Keyword
    modified = db.StringProperty()              # ISO date
    profiles = db.TextProperty()                # CSV of 1k most recent Prof Ids
    profcount = db.IntegerProperty()            # num Profile Ids total
    opportunities = db.TextProperty()           # CSV of 1k most recent Opp Ids
    oppcount = db.IntegerProperty()             # num Opportunity Ids total


def update_node_ids(key, objtype, objid, addback):
    keyname = canonize(key)
    node = Node.get_or_insert(keyname, name=key, modified=nowISO(), 
                              profiles="", profcount=0, 
                              opportunities="", oppcount=0)
    if objtype == "profile":
        node.profiles = remove_from_csv(objid, node.profiles)
        if addback:
            node.profiles = prepend_to_csv(objid, node.profiles)
        node.profcount = csv_elem_count(node.profiles)
    elif objtype == "opportunity":
        node.opportunities = remove_from_csv(objid, node.opportunities)
        if addback:
            node.opportunities = prepend_to_csv(objid, node.opportunities)
        node.oppcount = csv_elem_count(node.opportunities)
    node.put()


def update_match_nodes(objtype, objid, prevkeycsv, currkeycsv):
    objid = str(objid)
    # filter prevkeycsv to only contain keys that are not in currkeycsv
    currkeys = csv_list(currkeycsv)
    for key in currkeys:
        prevkeycsv = remove_from_csv(key, prevkeycsv)
    prevkeys = csv_list(prevkeycsv)
    # remove the old key values and update the new key values
    for key in prevkeys:
        update_node_ids(key, objtype, objid, False)
    for key in currkeys:
        update_node_ids(key, objtype, objid, True)
    # always update the "No Skills" catchall node
    update_node_ids("No Skills", objtype, objid, True)


# Returns the top level keywords for use in non-critical situations
# like keyword entry autocomplete.
class GetTopKeys(webapp2.RequestHandler):
    def get(self):
        myprof = profile.authprof(self)
        if not myprof:
            return
        sortindex = "oppcount"
        if self.request.get('search') == 'profile':
            sortindex = "profcount"
        nodes = Node.gql("ORDER BY " + sortindex + 
                         ", modified, name LIMIT 1200")
        keys = ""
        for node in nodes:
            if keys:
                keys += ","
            keys += node.name
        writeJSONResponse("[{\"keys\":\"" + keys + "\"}]", self.response)


class GetSkillNodes(webapp2.RequestHandler):
    def get(self):
        myprof = profile.authprof(self)
        if not myprof:
            return
        skills = self.request.get('skills')
        keys = []
        nodes = []
        if skills:
            logging.info("setting keys: " + skills)
            keys = csv_list(skills)
            keys = keys[:50]  # bound procesing within sane limits
        for key in keys:
            keyname = canonize(key)
            logging.info("keyname: " + keyname)
            node = Node.get_by_key_name(keyname)
            if node:
                nodes.append(node)
        returnJSON(self.response, nodes)



app = webapp2.WSGIApplication([('/topkeys', GetTopKeys),
                               ('/match', GetSkillNodes)
                               ], debug=True)

