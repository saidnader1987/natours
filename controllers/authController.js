const crypto = require('crypto');
const { promisify } = require('util');

const jwt = require('jsonwebtoken');

const User = require('./../models/userModel');
const catchAsync = require('./../util/catchAsync');
const AppError = require('./../util/appError');
const Email = require('./../util/email');

const signToken = id => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN
  });
};

const createAndSendToken = (user, statusCode, res) => {
  const token = signToken(user._id);

  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ), // browser or client will delete the cookie after the expiration
    httpOnly: true // cookie can't be accessed or modified in any way by the browser (for XSS attacks). So all the browser is gonna do when we set httpOnly to true is to basically receive the cookie, store it, and then send it automatically along with every request.
  };

  if (process.env.NODE_ENV === 'production') cookieOptions.secure = true; // cookie will only be sent when using https
  // (cookieName, token, options): name is like a unique identifier
  res.cookie('jwt', token, cookieOptions);

  // Remove password from output
  user.password = undefined;

  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user
    }
  });
};

exports.signup = catchAsync(async (req, res, next) => {
  const newUser = await User.create(req.body);
  const url = `${req.protocol}://${req.get('host')}/me`;
  console.log(url);
  await new Email(newUser, url).sendWelcome();
  createAndSendToken(newUser, 201, res);
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;
  // 1) Check if email and password exists
  if (!email || !password) {
    return next(new AppError('Please provide a valid email and password', 400));
  }
  // 2) Check if user exists and password is correct
  const user = await User.findOne({ email }).select('+password');

  if (!user || !(await user.correctPassword(password, user.password)))
    return next(new AppError('Incorrect email or password', 401));

  // 3) If everything is ok, send token to user
  createAndSendToken(user, 200, res);
});

exports.logout = (req, res, next) => {
  res.cookie('jwt', 'logged-out', {
    expires: new Date(Date.now() + 10 * 1000), // 10 seconds
    httpOnly: true
  });
  res.status(200).json({ status: 'success' });
};

exports.protect = catchAsync(async (req, res, next) => {
  // 1) Get the token and check if it exists
  let token = '';
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies.jwt) {
    token = req.cookies.jwt;
  }

  if (!token)
    return next(
      new AppError('You are not logged in. Please login to get access', 401)
    );

  // 2) Verification token
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

  // 3) Check if user still exists
  const currentUser = await User.findById(decoded.id);
  if (!currentUser) {
    return next(
      new AppError('The user belonging to this token does no longer exist', 401)
    );
  }
  // 4) Check if user changed password after token was issued
  if (currentUser.changesPasswordAfter(decoded.iat))
    return next(
      new AppError('User recently changed password. Please log in again', 401)
    );

  // GRANT ACCESS TO THE PROTECTED ROUTE
  req.user = currentUser;
  res.locals.user = currentUser;
  next();
});

exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    // roles is an array. This new middleware function has access to roles because of CLOSURES
    if (!roles.includes(req.user.role))
      // 403 means forbidden
      return next(
        new AppError('You do not have permission to perform this action', 403)
      );
    next();
  };
};

exports.forgotPassword = catchAsync(async (req, res, next) => {
  // 1) Get user based on posted email
  const user = await User.findOne({ email: req.body.email });
  if (!user)
    return next(new AppError('There is no user with that email address', 404));

  // 2) Generate random token
  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  // 3) Send token as email

  try {
    const resetURL = `${req.protocol}://${req.get(
      'host'
    )}//api/v1/users/resetPassword/${resetToken}`;
    await new Email(user, resetURL).sendPasswordReset();

    res.status(200).json({
      status: 'success',
      message: 'Token sent by email!'
    });
  } catch (err) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return next(
      new AppError(
        'There was an error sending the email. Please try again later',
        500
      )
    );
  }
});

exports.resetPassword = catchAsync(async (req, res, next) => {
  // 1) Get user based on the token
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  // find user who has this token (that was sent via the url). Check if token has not yet expired
  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() }
  });
  // 2) If token has not expired, and there is a user, set new password: 400 bad request
  if (!user) return next(new AppError('Token is invalid or has expired', 400));
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  // We do not turn off the validator because we want to confirm if passwords are equals (validate password confirmation)
  await user.save();
  // 3) Update the passwordChangedAt property for the current user

  // 4) Log user in, send JWT
  createAndSendToken(user, 200, res);
});

exports.updatePassword = catchAsync(async function(req, res, next) {
  // 1) Get user from collection
  // we can't just simply use const user = req.user and then user.password, because password is not inside the queried user object (select: false)
  // We can't also not use findByIdAndUpdate because validations will not run. Also the 2 'save' middlewares will not work
  // Not use update for all relating to passwords
  const user = await User.findById(req.user.id).select('+password');

  // 2) Check if posted password is correct
  const { passwordCurrent, password, passwordConfirm } = req.body;
  if (!(await user.correctPassword(passwordCurrent, user.password)))
    return next(new AppError('Incorrect password', 401));

  // 3) Update the password
  user.password = password;
  user.passwordConfirm = passwordConfirm;
  await user.save();

  // 4) Log user in, send JWT logged in with the new password
  createAndSendToken(user, 200, res);
});

// only for rendered pages and there will be no error
exports.isLoggedIn = async (req, res, next) => {
  // verify token
  if (req.cookies.jwt) {
    try {
      const token = req.cookies.jwt;

      const decoded = await promisify(jwt.verify)(
        token,
        process.env.JWT_SECRET
      );

      // 2) Check if user still exists
      const currentUser = await User.findById(decoded.id);
      if (!currentUser) {
        return next();
      }
      // 3) Check if user changed password after token was issued
      if (currentUser.changesPasswordAfter(decoded.iat)) return next();

      // There is a logged in user, put it in the response locals object so that it can be accessed in the template
      res.locals.user = currentUser;
    } catch (err) {
      return next();
    }
  }
  next();
};
