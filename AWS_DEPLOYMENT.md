# AWS Deployment Guide

Project: Restrox Restaurant Management System

## Current Deployment

Restrox is deployed as a single-origin MERN application:

- AWS Elastic Beanstalk runs the Node.js/Express backend.
- React/Vite is built into static files and served by Express from `server/public`.
- MongoDB Atlas is used as the production database.
- Elastic Beanstalk environment variables provide production configuration.

The frontend should call the backend through relative `/api` paths. For example, login should call:

```text
/api/auth/login
```

After deployment, the browser should resolve that to the same Beanstalk origin:

```text
http://retrox-backend-env.eba-zuztjrnm.us-east-1.elasticbeanstalk.com/api/auth/login
```

## Why This Deployment Strategy

The original split deployment used:

- AWS Amplify for the React frontend
- AWS Elastic Beanstalk for the Express backend

That caused a production browser issue because Amplify served the frontend over HTTPS while the Beanstalk backend was only available over HTTP. Browsers blocked the API requests as mixed content.

CloudFront and an Amplify rewrite proxy were not usable at the time:

- CloudFront could not be created because the AWS account required verification.
- Amplify rewrites could not proxy to an HTTP target because Amplify requires an HTTPS target.

The final solution is to serve the built frontend from Express so the frontend and backend share one Beanstalk origin.

## Required Environment Variables

Set these in the Elastic Beanstalk environment configuration:

```env
NODE_ENV=production
PORT=8080
MONGO_URI=MongoDB Atlas URI
CLIENT_URL=Beanstalk app URL
JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_refresh_secret
```

Notes:

- `PORT=8080` lets the app listen on the port expected by Elastic Beanstalk.
- `MONGO_URI` should point to MongoDB Atlas.
- `CLIENT_URL` should be the Beanstalk app URL while using the single-origin deployment.
- Do not commit real `.env` files or secrets.

## Build The Frontend

From the project root:

```bash
cd client
npm install
npm run build
```

This creates:

```text
client/dist/index.html
client/dist/assets/...
```

## Copy Frontend Build Into Backend

From the project root:

```bash
mkdir -p server/public
cp -R client/dist/. server/public/
```

Expected result:

```text
server/public/index.html
server/public/assets/...
```

## Backend Static Serving

The Express app serves API routes first, then the built frontend:

1. Middleware: CORS, Helmet, cookie parser, JSON parsing, logging, rate limiting
2. API routes under `/api`
3. Health checks
4. Static frontend files from `server/public`
5. React SPA fallback to `server/public/index.html`
6. 404 and error handlers

This route order is important. The React fallback must stay after API routes so missing or failing API routes do not incorrectly return `index.html`.

## Create Elastic Beanstalk Zip

Run this from inside `server`:

```bash
cd server
zip -r ../restrox-fullstack-v1.zip . -x "node_modules/*" ".env" ".env.*" "logs/*"
```

The zip should include:

```text
package.json
src/
public/index.html
public/assets/...
```

The zip should not include:

```text
node_modules/
.env
.env.*
logs/
```

Upload `restrox-fullstack-v1.zip` to the Elastic Beanstalk environment.

## Verification

After deployment, open:

```text
http://retrox-backend-env.eba-zuztjrnm.us-east-1.elasticbeanstalk.com
```

Expected behavior:

- The React frontend loads from the Beanstalk URL.
- Login calls `/api/auth/login` on the same Beanstalk origin.
- Health check still works at `/api/health`.

The browser Network tab should show login calling:

```text
http://retrox-backend-env.eba-zuztjrnm.us-east-1.elasticbeanstalk.com/api/auth/login
```

It should not call:

```text
http://retrox-backend-env.eba-zuztjrnm.us-east-1.elasticbeanstalk.com/auth/login
https://main.d1tt0o8qxxw5rg.amplifyapp.com/auth/login
http://localhost:5000/auth/login
```

## Future Improvements

- Add HTTPS using a custom domain, Application Load Balancer, and AWS Certificate Manager.
- Move the frontend back to Amplify or S3/CloudFront after HTTPS is available for the backend.
- Add GitHub Actions CI/CD for build, test, and deployment.
- Split backend features into microservices if operational complexity justifies it.
- Convert infrastructure to Terraform for repeatable AWS provisioning.
