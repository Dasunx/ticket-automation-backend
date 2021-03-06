const jwt = require('jsonwebtoken');
const expressJwt = require('express-jwt'); // to protect routes by checking tokens validity.

const HttpError = require('../models/http-error');
const User = require('../models/user');
const Manager = require('../models/manager');
const Foreigner = require('../models/foreigner');
const Local = require('../models/local');

const signup = async (req, res, next) => {
  const {
    name,
    email,
    password,
    managerId,
    native,
    nic,
    passportId,
  } = req.body;
  let user;
  try {
    user = await User.findOne({ email: email });
  } catch (err) {
    const error = new HttpError(
      'something went wrong on the db, when retriving User',
      500
    );
    return next(error);
  }

  if (user) {
    return res.status(400).json({
      error: 'email has already been registerd. Please Login.',
    });
  }
  let newUser;
  if (managerId) {
    newUser = new Manager({
      name,
      email,
      password,
      managerId,
      role: 'Manager',
    });
  } else if (native === true) {
    newUser = new Local({ name, email, password, nic, role: 'Local' });
  } else if (native === false) {
    newUser = new Foreigner({
      name,
      email,
      password,
      passportId,
      role: 'Foreigner',
    });
  }
  try {
    await newUser.save();
  } catch (err) {
    const error = new HttpError(
      'something went wrong on the db, when saving the user in db',
      500
    );
    return next(error);
  }
  let token;
  try {
    token = jwt.sign({ _id: newUser._id }, process.env.JWT_SECRET, {
      expiresIn: '1h',
    });
    // generate a cookie with the token
    res.cookie('token', token, { expiresIn: '1h' });
    // send user details and token to the front end
  } catch (err) {
    const error = new HttpError(
      `sigining up faild, toke creation error!+${err}`,
      500
    );
    return next(error);
  }
  const { _id, role, balance } = newUser;
  return res.json({
    token,
    user: { _id, name, email, role, balance },
  });
};

const login = async (req, res, next) => {
  const { email, password } = req.body;
  let user;
  try {
    user = await User.findOne({ email: email });
  } catch (err) {
    const error = new HttpError('Something went wrong on server side', 500);
    return next(error);
  }
  if (!user) {
    const error = new HttpError('User does not exsists! Sign up instead.', 500);
    return next(error);
  }
  // Authentication
  if (!user.authenticate(password)) {
    return res.status(400).json({
      error: { msg: 'email and password do not match' },
    });
  }
  // generate a token
  const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET, {
    expiresIn: '1h',
  });
  // generate a cookie with the token
  res.cookie('token', token, { expiresIn: '1h' });
  // send user details and token to the front end
  const { _id, name, role, balance } = user;

  return res.json({
    token,
    user: { _id, name, email, role, balance },
  });
};

const managerInfo = async (req, res, next) => {
  const managerUserId = req.user._id; //  retrived from requiredSignin middleware

  let manager;
  try {
    manager = await User.findById({ _id: managerUserId }, '-hashed_password');
  } catch (err) {
    const error = new HttpError(
      'something went wrong on the db, when retriving the given manager',
      500
    );
    return next(error);
  }

  if (!manager) {
    return res.status(400).json({
      error: 'Manger not found',
    });
  }
  if (manager.role !== 'Manager') {
    //  admin ->1 , user -> 0
    return res.status(400).json({
      error: 'Manager resources, Access denied!',
    });
  }

  req.profile = manager;
  next();
};

const userInfo = async (req, res, next) => {
  const { uid } = req.params;
  let user;
  try {
    user = await User.findById({ _id: uid }, '-hashed_password')
      .populate('paymentHistory')
      .populate({ path: 'journey', populate: { path: 'busId' } })
      .populate({ path: 'journeyHistory', populate: { path: 'busId' } })
      .populate({ path: 'fineHistory', populate: { path: 'managerId' } });
    if (!user) {
      return res.status(400).json({
        error: 'No user found',
      });
    }
    return res.json(user);
  } catch (err) {
    const error = new HttpError(
      'something went wrong on the db, when retriving the given manager',
      500
    );
    return next(error);
  }
};
/*
 * Checks the token validity
 * We can use this to protect routes which only meant to access by loggedIn users.
 * This also has the user id, because when we generate the token we added the user id.
 */
const requireSignIn = expressJwt({
  secret: process.env.JWT_SECRET,
  algorithms: ['HS256'],
});

exports.signup = signup;
exports.login = login;
exports.requireSignIn = requireSignIn;
exports.managerInfo = managerInfo;
exports.userInfo = userInfo;
