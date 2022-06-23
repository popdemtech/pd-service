## Capturing User Information
The strength of a database comes into play when the developer uses it to capture user interaction within the web application. This saved information can then be displayed to the user to demonstrate the applications interactivity.

### Click Tracker Application
This feature will allow any user to click a button and counter will increment. This counter increments over time as users click the button. If you think about it, users from anywhere on the globe can log into this application, and click this button. Pretty cool.

This feature will require:
* a button
* text displaying how many times the button has been clicked

### 1. Decide the data model
This feature will require that we persist the total number of times a button has been clicked in a database. To accomplish this, we will create a database table, `Clicks`.
```
Clicks
-----------+-------------+
user       | VARCHAR
createdAt  | DATE
updatedAt  | DATE
```

To find how many times the button has been clicked, a SQL `COUNT(*)` command can be used. This data model has the additional benefit of saving user information with the click event. This will be aided by the authentication system, and allows for a follow-up feature of displaying how many times a particular user has clicked the button.

Generate a model and migration using Sequelize's `model:generate` command, and migrate the database with `db:migrate`.

<div class="filename">command line</div>

```
$ npx sequelize model:generate --name Click --attributes user:string
$ npx sequelize db:migrate
```

### 2. Create the web page route
Within `index.js`, create a route, `/click-tracker`. This route should render a page `click-tracker.liquid`.

The number of times the button has been clicked in total will be saved in a database, and fetched at the initial user request. The liquid-HTML template will be rendered with this number. Hard-code the value to 10 for now.

1. Import the `Click` class from Sequelize's model directory.

<div class="filename">index.js</div>

```javascript
const { Post, Click } = require('./app/models');
```

2. Create the route.
The route handler must be labeled async to be able to use the asynchronous `await Click.count()`. Send the result of `Click.count()` to the view as the template variable `timesClicked`.

<div class="filename">index.js</div>

```javascript
app.get('/click-tracker', async function (request, response) {
  response.render('click-tracker', {
    timesClicked: await Click.count()
  });
});
```

3. Create the webpage.
A view template named `click-tracker.liquid` must be created.

<div class="filename">views/click-tracker.liquid</div>

```html
{% layout 'layouts/default-html.liquid' %}
{% block content %}
<h1>Click Tracker</h1>
<button id="click-me">Click Me!</button>
<p>This button has been clicked <span id="times-clicked">{{ timesClicked }}</span> times.</p>
{% endblock %}
```

You should now be able to start the server, navigate to `https://localhost:3000/click-tracker`, and see the desired initial page.

### 3. Handle user interaction
At this point, nothing happens if a user clicks the on-screen button. Let's change this by adding a JavaScript click event listener on the button. Add a `<script>` tag within the `content` block.

<div class="filename">views/click-tracker.liquid</div>

```html
<script>
  const button = document.getElementById('click-me');
  button.addEventListener('click', function(event) {
    console.log('Button clicked!');
  });
</script>
```

### 4. Make API request on click
For the moment, the click handling function only prints out `'Button clicked!'`. The desired functionality is for the button click to initiate a request to the webserver. The webserver will receive the request and add a `Click` database record.

From the front-end, we will use the Fetch API to make and handle the network request. The Fetch API provides a JavaScript interface for fetching resources and interacting with the HTTP pipeline. Within a browser (e.g. Chrome), a global  `fetch()` method provides an easy-to-use way to fetch resources asynchronously across the network.

The `fetch()` method returns a Promise. A JavaScript Pro

Replace the `console.log` within the click handler with a `fetch` call.

<div class="filename">views/click-tracker.liquid</div>

```html
<script>
  const button = document.getElementById('click-me');
  button.addEventListener('click', function(event) {
    fetch('/api/clicks', { method: 'POST' })
    .then((response) => {
      response.ok ? console.log('Click Added') : console.log('Error Occured');
    });
  });
</script>
```
The `response.ok` is a utility property on the `Response` object returned by `fetch`. A response with an HTTP status code 200-299 has and `ok` value of `true`.

### 5. Create the API route
In line with RESTful standards, we will make a route that accepts a `POST` request to `/clicks` to create a click resource. The the `POST` request is successful, we will return to the user the new total number of clicks in the database.

1. Create the POST `/clicks` route

<div class="filename">indes.js</div>

```javascript
app.post('/api/clicks', async function(request, response) {
  const user = request.oidc.user ? request.oidc.user.email : null;
  await Click.create({ user: user });
  response.json({ timesClicked: await Click.count() });
});
```

### 6. Handle an error using Express middleware
Due to validations and user input errors, creating database records is a process that is expectedly error prone. Click Tracker deals with a relatively small model with no truly custom user input, yet it is good practice to handle where known errors may arise and deliver useful information to the front-end application and user.

The Express way to handle errors is to use its middleware framework. We have already used Express' middleware in implementing the `auth()` functionality. The middleware framework is a pipeline of functions that have access to the `request` and `response` objects. A given middleware can execute any code and make changes to the `request` and `response` objects. When it is done with its computation, it must end the request/response cycle or call the `next` middleware function in the pipeline.

In this way, every route that is defined -- e.g. `GET /hello-world` -- is part of the middleware pipeline. The routes created thus far end the request/response cycle by not calling a `next` middleware. In fact, because `next` has not been needed, I have left this variable out of the route handler definitions. An Express route handler has the following signature:

<div class="filename">pseudocode</div>

```javascript
const routeHandler = function(request, response, next) { ... };
app.get('/path', routeHandler);
```

A middleware handler has the similar signature:

<div class="filename">pseudocode</div>

```javascript
const middleware = function(request, response, next) { ... };
app.use(middlewareHandler);
```

Error handling middleware has a slightly differing signature; the first parameter is a JavaScript error object.

<div class="filename">pseudocode</div>

```javascript
const errorHandlingMiddleware = function(error, request, response, next) { ... };
app.use(errorHandlingMiddleware);
```
The application knows to use the error handling middleware if `next` is invoked with an error object.

1. Create the error handling middleware.
As will all middleware, Express will invoke the functions in the order they are applied to the application with `app.use()`, top to bottom. As such, `app.use` this middleware below the route definitions within `index.js`.

<div class="filename">index.js</div>

```javascript
app.use(function (error, request, response, next) {
  if (!error.apiError) {
    return next(error, request, response, next);
  }
  response.status(error.statusCode);
  response.json({ message: error.message });
});
```
This code checks for the existance of the a property `apiError` on the `error` parameter. If it is not present, the function passes the error to the next error handling middleware. If the property is present, the status of the response is set to the statusCode of the error, and a JSON response is returned with the error's message.

An important aspect of this code is that it returns a JSON response. Express' default error handler returns an HTML response. For `pd-service`, we will standardize this behavior and return JSON in case of error.

2. Invoke the error handler in case of application error.
With the error handler is in place, the route handler must be changed to pass any errors to the error handling middleware. The third parameter, `next`, should be added to the handler's function definition. It has always been passed in at runtime, but because it was unnecessary, it hasn't been added to the code until now.

`Click.create` will throw an error if the create is unsuccessful. Wrap this function call in a `try/catch` block. If an error is caught, set the properties on it the custom error handling middleware is expecting -- `apiError` and `statusCode` -- and invoke the `next` middleware the error.

<div class="filename">index.js</div>

```javascript
app.post('/api/clicks', async function(request, response, next) {
  const user = request.oidc.user ? request.oidc.user.email : null;
  try {
    await Click.create({ user: user });
    response.json({ timesClicked: await Click.count() });
  } catch (e) {
    e.apiError = true;
    e.statusCode = 422;
    next(e);
  }
});
```

With the last line -- `next(e)` -- the request/response cycle is moved to the error handling middleware pipeline.

### 7. Handle the API response
The sequence of events currently programmed is the following:
* User clicks the button
* A `fetch` request is made to the `/clicks` route
* The route processes the request and returns a JSON response

A response handler must be written within the front-end JavaScript to process the response.

The `fetch` call resolves to a `Response` interface that represents the response to a request. The `json()` method on this interface returns a promise of the result of parsing the response body into JSON. We'll want to access the `timesClicked` property we set on the response body.

<div class="filename">views/click-tracker.liquid</div>

```html
<script>
  const button = document.getElementById('click-me');
  button.addEventListener('click', function(event) {
    fetch('/api/clicks', { method: 'POST' })
    .then((response) => {
      if (!response.ok) return;
      
      response.json()
      .then((data) => {
        document.getElementById('times-clicked').innerHTML = data.timesClicked;
      });
    });
  });
</script>
```
The script makes use of a preset `<span id="times-clicked">`, and replaces the value that present there with the more recent count of clicks.

You should now be able to click the button multiple times and see the number on screen increment by one each time. If you refresh the page, the number will remain at the last seen value.

### 8. Handle the API error response
It is good practice to inform the user of an application error. It's wise to consider whether the user can be helped by the error. For example, it's prudent to show the user if the error is due to an input validation error; the user can change their input and correct the problem. If the error is due to an obscure error the user cannot correct, such as invalid database credentials failing authentication, it is more appropriate to show the user a generic error or none at all.

The case of the Click Tracker application coming into an error state fits into the latter distinction. The plan is to place an error message within the HTML. It will be hidden by default, but when an error response is received, it will be displayed. Whenever a new request is initalized -- when the user re-clicks the button -- the error message will be re-hidden while the new `fetch` request is sent and allowed to return successfully or not.

1. Add the HTML/CSS for error handling.
For this, we will need to add the error message element, and set it to be hidden by default. Add the new element after the `click-me` button. Add the style tags within the `content` block.

<div class="filename">views/click-tracker.liquid</div>

```html
<span id="error" class="hidden">Oops, something happened.</span>

<style>
  .hidden {
    display: none;
  }

  #error {
    color: red;
  }
</style>
```

2. Add error handling JavaScript
When an error response is encountered, remove the `hidden` class on the `#error` element to remove the `display: none` attribute. In the case of resubmitting the button click, hide the element again by re-adding the `hidden` class.

<div class="filename">views/click-tracker.liquid</div>

```html
<script>
  const button = document.getElementById('click-me');
  button.addEventListener('click', function(event) {
    document.getElementById('error').classList.add('hidden');

    fetch('/api/clicks', { method: 'POST' })
    .then((response) => {
      if (!response.ok) {
        document.getElementById('error').classList.remove('hidden');
        return;
      };

      response.json()
      .then((data) => {
        document.getElementById('times-clicked').innerHTML = data.timesClicked;
      });
    });
  });
</script>
```

To test the error handling, you can force the API to return an error response.

<div class="filename">index.js</div>

```javascript
app.post('/api/clicks', async function(request, response, next) {
  // const user = request.oidc.user ? request.oidc.user.email : null;
  // try {
  //   await Click.create({ user: user });
  //   response.json({ timesClicked: await Click.count() });
  // } catch (e) {
  //   e.apiError = true;
  //   e.statusCode = 422;
  //   next(e);
  // }

  const e = new Error();
  e.apiError = true;
  e.statusCode = 500;
  next(e);
});

```

Be sure to revert this intermediate step for the application to function as planned long-term.

### 9. Add a homepage link
Add the Click Tracker app to the list of pages on the homepage.

<div class="filename">views/index.liquid</div>

```html
<li><a href="/click-tracker">Click Tracker</a></li>
```

### 10. Commit and deploy
1. Commit the repository
Git commit the new changes and deploy to Heroku to see the results in a deployed environment.

<div class="filename">command line</div>

```
$ git add .
$ git commit -m 'Add Click Tracker'
$ git push heroku HEAD
```

2. Migrate the production database
There is now a new table the application expects to be in the database. A database migration must be run on the Heroku Postgres instance to create this table.

<div class="filename">command line</div>

```
$ heroku run sequelize db:migrate
```

3. Run the deployed application

<div class="filename">command line</div>

```
$ heroku open
```

Navigate to `/click-tracker` directly or via the homepage link, and verify the incrementing Click Tracker.

### Resources

What is Web 2.0?: [https://www.znetlive.com/blog/web-2-0/](https://www.znetlive.com/blog/web-2-0/)

Using the Fetch API: [https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch)

Express Error Handling: [http://expressjs.com/en/guide/error-handling.html](http://expressjs.com/en/guide/error-handling.html)

JavaScript Promises: [https://nodejs.dev/learn/understanding-javascript-promises](https://nodejs.dev/learn/understanding-javascript-promises#chaining-promises)