#!/usr/bin/env python3

import sys
from aiohttp import web, client
import asyncio

async def http_root_handler(request):
    with open('resources/index.html') as f:
        return web.Response(text=f.read(), content_type='text/html')

async def forward(request, url):
  #print('>', url)
  headers = {'Accept': 'application/vnd.phereo.v3+json'}
  for k in ('Cache-Control', 'If-Modified-Since', 'If-None-Match', 'User-Agent'):
    if k in request.headers:
      headers[k] = request.headers[k]
  async with client.request(
      'GET',
      url,
      headers = headers,
      allow_redirects = False,
      data = await request.read()
  ) as res:
    if res.status == 404:
      raise web.HTTPNotFound()
    elif res.status == 302:
      raise web.HTTPFound(location=res.headers.get('Location'))
    elif res.status == 304:
      raise web.HTTPNotModified()
    elif res.status != 200:
      raise web.HTTPInternalServerError() # Not expected
    headers = {'Access-Control-Allow-Origin': '*'}
    for k in ('Content-Type', 'Expires', 'Cache-Control', 'Pragma', 'ETag', 'Last-Modified'):
      if k in res.headers:
        headers[k] = res.headers[k]
    return web.Response(
      status = 200,
      headers = headers,
      body = await res.read()
    )

async def http_img_handler(request):
  try:
    ret = await forward(request, 'https://api.phereo.com/imagestore2/'+request.match_info['img']+'/sidebyside/l/')
  except web.HTTPNotFound:
    try:
      ret = await forward(request, 'https://api.phereo.com/imagestore/'+request.match_info['img']+'/sidebyside/l/')
    except web.HTTPNotFound:
      with open('resources/img_404.webp', 'rb') as f:
        ret = web.StreamResponse(headers={'Access-Control-Allow-Origin': '*', 'Content-Type': 'image/webp'})
        await ret.prepare(request)
        await ret.write(f.read())
  return ret

async def http_thumb_handler(request):
  try:
    ret = await forward(request, 'https://api.phereo.com/imagestore/'+request.match_info['img']+'/thumb.square/280/')
  except web.HTTPNotFound:
    try:
      ret = await forward(request, 'https://api.phereo.com/imagestore2/'+request.match_info['img']+'/thumb.square/280/')
    except web.HTTPNotFound:
      with open('resources/thumb_404.webp', 'rb') as f:
        ret = web.StreamResponse(headers={'Access-Control-Allow-Origin': '*', 'Content-Type': 'image/webp'})
        await ret.prepare(request)
        await ret.write(f.read())
  return ret

async def http_avatar_handler(request):
  try:
    return await forward(request, 'https://api.phereo.com/avatar/'+request.match_info['img']+'/100.100')
  except web.HTTPFound as e:
    raise web.HTTPFound(location=e.location.replace('http://', 'https://'))

async def http_comments_handler(request):
  return await forward(request, 'http://api.phereo.com/images/'+request.match_info['img']+'/comments?offset=0&count=100')

async def api_forward(request, cat, offset):
  return await forward(request, 'http://api.phereo.com/api/open/'+cat+'offset='+offset+'&count=25&adultFilter=2')

async def http_api_category_handler(request):
  return await api_forward(request, request.match_info['category']+'?', request.match_info['offset'])  

async def http_api_user_handler(request):
  return await api_forward(request, 'images/?user='+request.match_info['uid']+'&userId=&userApi=&', request.match_info['offset'])

async def http_api_tag_handler(request):
  return await api_forward(request, 'search_tags/?ss='+request.match_info['tag']+'&userId=&userApi=&', request.match_info['offset'])

async def http_api_search_handler(request):
  return await api_forward(request, 'search/?ss='+request.match_info['q']+'&userId=&userApi=&', request.match_info['offset'])

async def http_api_username_handler(request):
  return await api_forward(request, 'search_users/?ss='+request.match_info['q']+'&userId=&userApi=&', request.match_info['offset'])

@web.middleware
async def error_middleware(request, handler):
    try:
        return await handler(request)
    except web.HTTPNotFound:
        return web.Response(text='404 Not Found', status=404, headers={'Access-Control-Allow-Origin': '*'})

async def start_server(host, port):
    app = web.Application()
    app.add_routes([
      web.get('/', http_root_handler),
      web.get('/img/{img:[a-f0-9]{24}}.jpg', http_img_handler),
      web.get('/thumb/{img:[a-f0-9]{24}}.jpg', http_thumb_handler),
      web.get('/avatar/{img:[a-f0-9]{24}}.jpg', http_avatar_handler),
      web.get('/comments/{img:[a-f0-9]{24}}.json', http_comments_handler),
      web.get('/api/{category:(latestuploads|awards|staffpicks|popular)}/{offset:\d+}.json', http_api_category_handler),
      web.get('/api/user:{uid:[a-f0-9]{24}}/{offset:\d+}.json', http_api_user_handler),
      web.get('/api/tag:{tag}/{offset:\d+}.json', http_api_tag_handler),
      web.get('/api/search:{q}/{offset:\d+}.json', http_api_search_handler),
      web.get('/api/username:{q}/{offset:\d+}.json', http_api_username_handler),
      web.static('/', 'resources'),
    ])
    app.middlewares.append(error_middleware)
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, host, port)
    await site.start()
    print(f'Listening {host}:{port}')

if __name__ == '__main__':
    host = '0.0.0.0'
    port = 8080
    if len(sys.argv) >= 2:
        host = sys.argv[1]
        port = sys.argv[2]
    elif len(sys.argv) == 2:
        port = sys.argv[1]
    try:
        loop = asyncio.get_event_loop()
        loop.run_until_complete(start_server(host, port))
        loop.run_forever()
    except KeyboardInterrupt:
        print('Bye.')