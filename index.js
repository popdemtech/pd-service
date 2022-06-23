const express = require('express');
const app = express();
const { auth } = require('express-openid-connect');
require('dotenv').config();
const http = require('http').Server(app);
const io =  require('socket.io')(http);
const { Liquid } = require('liquidjs');
const engine = new Liquid();
const port = process.env.PORT || 3000;

// Models
const { Post, Click, Book, BookSection } = require('./app/models');

// Views
app.engine('liquid', engine.express());
app.set('views', './app/views');
app.set('view engine', 'liquid');

// Static files
app.use(express.static('public'));

// Auth0
const config = {
  authRequired: false,
  auth0Logout: true,
  secret: process.env.AUTH0_SECRET,
  baseURL: process.env.AUTH0_BASE_URL,
  clientID: process.env.AUTH0_CLIENT_ID,
  issuerBaseURL: process.env.AUTH0_ISSUER_BASE_URL,
  routes: {
    callback: process.env.AUTH0_CALLBACK_ROUTE
  }
};

app.use(auth(config));

// Routes
app.get('/', async function(request, response) {
  const loggedIn = request.oidc.isAuthenticated();
  response.render('index', { loggedIn });
});

app.get('/chat', function(request, response) {
  response.sendFile(__dirname + '/chat.html');
});

app.get('/ping', function(request, response) {
  response.json({ ping: 'pong!' })
});

app.get('/hello-world', function(request, response) {
  const showDog = request.query.showDog == 'false' ? false : true;
  response.render('hello-world', {
    showDog,
    date: new Date()
  });
});

app.get('/hello-dog', function(request, response) {
  response.redirect('/hello-world?showDog=true');
});

app.get('/generate-pdf', function(request, response) {
  response.render('generate-pdf');
});

app.get('/invoice-creator', function(request, response) {
  response.render('invoice-creator');
});

app.get('/env-vars', function (request, response) {
  const isProduction = process.env.NODE_ENV == 'production';
  const auth0BaseUrl = process.env.AUTH0_BASE_URL;
  response.render('env-vars', { isProduction, auth0BaseUrl })
});

app.get('/posts', async (request, response) => {
  response.render('posts', {
    posts: await Post.findAll()
  });
});

app.get('/click-tracker', async function (request, response) {
  response.render('click-tracker', {
    timesClicked: await Click.count()
  });
});

app.get('/books', async function(request, response) {
  const books = await Book.findAll();
  response.render('books/index', { books });
});

app.get('/books/:slug', async function(request, response, next) {
  const book = await Book.findOne({
    where: { slug: request.params.slug },
    include: BookSection
  });
  if (book == null) {
    response.status(404);
    next();
    return;
  }
  
  const bookTree = BookSection.toTree(book.BookSections);

  response.render('books/show', { book, bookTree });
});

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

app.use(function(request, response, next) {
  if (response.statusCode === 404) {
    response.render('404');
    return;
  }
  next();
});

app.use(function (error, req, res, next) {
  if (!error.apiError) {
    return next(error);
  }
  res.status(error.statusCode);
  res.json({ message: error.message });
});

// Socketry
io.on('connection', function(socket) {
  console.log('a user connected');

  socket.on('chat-message', function(msg){
    io.emit('chat-message-from-server', msg);
  });
  
  socket.on('disconnect', function() {
    console.log('a user disconnected');
  });
});

http.listen(port, function() {
  console.log(`listening on port ${port}`)
});