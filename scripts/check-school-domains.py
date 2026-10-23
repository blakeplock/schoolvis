#!/usr/bin/env python3
"""Bounded HTTPS evidence collection for existing CC0 Wikidata P856 school website candidates.
Does not infer or certify ownership; makes no requests for schools without candidates.
"""
import argparse
import datetime as dt
import html
import ipaddress
import json
import re
import socket
import sqlite3
import ssl
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

DB=Path.home()/'.schoolvis'/'schools.sqlite'
UA='SchoolVis/0.11.3 (website candidate evidence; https://github.com/blakeplock/schoolvis)'
SCHEMA={
 'domain_check_status':"TEXT NOT NULL DEFAULT 'not_checked'",
 'domain_check_detail':"TEXT NOT NULL DEFAULT ''",
 'domain_check_at':"TEXT NOT NULL DEFAULT ''",
 'domain_check_title':"TEXT NOT NULL DEFAULT ''",
 'domain_check_url':"TEXT NOT NULL DEFAULT ''",
}

def migrate(db):
 cols={row[1] for row in db.execute('PRAGMA table_info(wikidata_schools)')}
 if not cols: raise ValueError('No Wikidata school registry. Import and enrich first.')
 with db:
  for col,definition in SCHEMA.items():
   if col not in cols: db.execute(f'ALTER TABLE wikidata_schools ADD COLUMN {col} {definition}')

def public_https(url):
 try:
  u=urllib.parse.urlsplit(url)
  if u.scheme!='https' or not u.hostname or u.username or u.password or u.port not in (None,443): return False
  if len(url)>2048 or len(u.hostname)>253 or not re.fullmatch(r'[A-Za-z0-9.-]+',u.hostname):return False
  if '.' not in u.hostname or u.hostname.endswith('.local') or u.hostname.endswith('.internal'):return False
  try:
   ipaddress.ip_address(u.hostname)
   return False
  except ValueError:
   pass
 except ValueError:return False
 return True

def public_addresses(host):
 addresses=[]
 for info in socket.getaddrinfo(host,443,type=socket.SOCK_STREAM):
  addr=ipaddress.ip_address(info[4][0]);addresses.append(str(addr))
  if not addr.is_global: raise ValueError('Nonpublic DNS address')
 if not addresses:raise ValueError('DNS did not resolve')
 return addresses

class NoRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,request,fp,code,msg,headers,newurl):return None

def domain_evidence(url,school_name,open_request=None):
 if not public_https(url):return ('rejected','Not an allowed public HTTPS URL','','')
 host=urllib.parse.urlsplit(url).hostname
 try: public_addresses(host)
 except (OSError,ValueError) as e:return ('dns_unavailable',str(e)[:200],'','')
 if open_request is None:
  # HTTPS connections are pinned to a DNS-resolved address by a custom SSL client.
  # urllib does not pin DNS; use a single validated IP with HTTP Host and SNI below.
  import http.client
  class PinnedHTTPS(http.client.HTTPSConnection):
   def __init__(self,hostname,ip,**kw):super().__init__(hostname,**kw);self.ip=ip
   def connect(self):
    self.sock=socket.create_connection((self.ip,self.port),self.timeout)
    self.sock=self._context.wrap_socket(self.sock,server_hostname=self.host)
  ip=public_addresses(host)[0]
  u=urllib.parse.urlsplit(url)
  path=(u.path or '/')+('?' + u.query if u.query else '')
  def open_request():
   conn=PinnedHTTPS(host,ip,timeout=8,context=ssl.create_default_context())
   try:
    conn.request('GET',path,headers={'Host':host,'User-Agent':UA,'Accept':'text/html','Range':'bytes=0-65535'})
    response=conn.getresponse();code=response.status;ctype=response.getheader('Content-Type','')
    data=response.read(65536)
    return code,ctype,data,response.getheader('Location','')
   finally:conn.close()
 try:
  code,ctype,data,location=open_request()
  if code in (301,302,303,307,308):return ('redirect_unverified',f'HTTP {code}; redirect target not followed: {location[:160]}','','')
  if code!=200:return ('http_error',f'HTTP {code}','','')
  if 'html' not in ctype.lower():return ('not_html',f'Content type: {ctype[:100]}','','')
  snippet=data.decode('utf-8','replace')
  match=re.search(r'<title\b[^>]*>(.*?)</title\s*>',snippet,re.I|re.S)
  title=html.unescape(re.sub(r'<[^>]+>',' ',match.group(1))).strip()[:240] if match else ''
  # A title is evidence of page branding, not confirmation of domain ownership.
  words={w.lower() for w in re.findall(r'[a-zA-Z]{4,}',school_name) if w.lower() not in {'school','academy','private','the','high','college','saint','preparatory','institute'}}
  overlap=sorted(w for w in words if re.search(r'\b'+re.escape(w)+r'\b',title,re.I))
  status='name_correlated' if overlap else 'reachable_unconfirmed'
  return status,(f'HTTP 200; title-name tokens: {", ".join(overlap)}' if overlap else 'HTTP 200; no distinctive name match in page title'),title,url
 except (OSError,TimeoutError,ssl.SSLError,ValueError) as e:return ('request_failed',str(e)[:200],'','')

def run(dbfile,limit,delay):
 db=sqlite3.connect(dbfile)
 try:
  migrate(db)
  records=db.execute('SELECT id,name,website_candidate FROM wikidata_schools WHERE website_candidate IS NOT NULL AND website_candidate != ? ORDER BY id LIMIT ?',('',limit)).fetchall()
  for i,(qid,name,url) in enumerate(records,1):
   status,detail,title,final=domain_evidence(url,name)
   with db:
    db.execute('UPDATE wikidata_schools SET domain_check_status=?,domain_check_detail=?,domain_check_title=?,domain_check_url=?,domain_check_at=? WHERE id=?',(status,detail,title,final,dt.datetime.now(dt.timezone.utc).isoformat(),qid))
   print(f'[{i}/{len(records)}] {qid} {status}: {name}',flush=True)
   time.sleep(delay)
 finally:db.close()

def report(dbfile):
 db=sqlite3.connect(dbfile)
 try:
  migrate(db)
  print('Domain evidence (never proof of school ownership):')
  for k,n in db.execute('SELECT domain_check_status,COUNT(*) FROM wikidata_schools GROUP BY domain_check_status ORDER BY COUNT(*) DESC'):
   print(f'  {k}: {n}')
  print('No institution website is automatically marked verified.')
 finally:db.close()

if __name__=='__main__':
 parser=argparse.ArgumentParser(description=__doc__)
 parser.add_argument('--db',type=Path,default=DB)
 parser.add_argument('--limit',type=int,default=150)
 parser.add_argument('--delay',type=float,default=1)
 parser.add_argument('--report-only',action='store_true')
 a=parser.parse_args()
 if not 1<=a.limit<=5000 or not .2<=a.delay<=10:parser.error('Invalid limits')
 if a.report_only:report(a.db.expanduser())
 else:run(a.db.expanduser(),a.limit,a.delay);report(a.db.expanduser())
