import base64
s=open('promo.src.html').read()
b=lambda p: base64.b64encode(open(p,'rb').read()).decode()
s=s.replace('__GEIST__',b('node_modules/geist/dist/fonts/geist-sans/Geist-Variable.woff2')).replace('__GEISTMONO__',b('node_modules/geist/dist/fonts/geist-mono/GeistMono-Variable.woff2'))
open('promo.html','w').write(s)
