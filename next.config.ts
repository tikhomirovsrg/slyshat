import type { NextConfig } from 'next';
const config: NextConfig = {
  output: 'standalone', poweredByHeader: false,
  async headers() { return [{source:'/:path*',headers:[
    {key:'X-Content-Type-Options',value:'nosniff'},
    {key:'X-Frame-Options',value:'DENY'},
    {key:'Referrer-Policy',value:'no-referrer'},
  ]},{source:'/audio/:folder(library|course|characters|expansion)/:file.mp3',headers:[
    {key:'Cache-Control',value:'public, max-age=31536000, immutable'},
  ]},{source:'/comics/characters/v1/:file*',headers:[{key:'Cache-Control',value:'public, max-age=31536000, immutable'}]},{source:'/comics/v1/:file*',headers:[{key:'Cache-Control',value:'public, max-age=31536000, immutable'}]}]; },
};
export default config;
