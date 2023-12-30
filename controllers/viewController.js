const Tour = require('../models/tourModel');
const AppError = require('../util/appError');
const catchAsync = require('../util/catchAsync');
const User = require('../models/userModel');
const Booking = require('../models/bookingModel');

exports.getOverview = catchAsync(async (req, res, next) => {
  // 1) Get tour data from collection
  const tours = await Tour.find();
  // 2) Build template

  // 3) Render that template using tour data from 1
  res.status(200).render('overview', {
    title: 'This is the tour overview',
    tours
  });
});

exports.getTour = catchAsync(async (req, res, next) => {
  // 1) get tge data for the requested tour (including guides and reviews)
  const tour = await Tour.findOne({ slug: req.params.slug }).populate({
    path: 'reviews',
    fields: 'review rating user'
  });

  if (!tour) {
    return next(new AppError('No tour found with that name', 404));
  }
  // 2) Bild template

  // 3) Render the template using the data from 1
  res.status(200).render('tour', { title: `${tour.name} Tour`, tour });
});

exports.getMyTours = catchAsync(async (req, res, next) => {
  // 1. Find all bookings
  const bookings = await Booking.find({ user: req.user.id });

  // 2. Find tours with the returned ids
  const tourIds = bookings.map(el => el.tour);
  const tours = await Tour.find({ _id: { $in: tourIds } });

  res.status(200).render('overview', { title: 'My tours', tours });
});

exports.getLoginForm = (req, res) => {
  res.status(200).render('login', { title: 'Log into your account' });
};

exports.getAccount = (req, res) => {
  res.status(200).render('account', { title: 'Your account' });
};

exports.updateUserData = catchAsync(async (req, res) => {
  const updatedUser = await User.findByIdAndUpdate(
    req.user.id,
    {
      name: req.body.name,
      email: req.body.email
    },
    {
      new: true,
      runValidators: true
    }
  );
  res
    .status(200)
    .render('account', { title: 'Your account', user: updatedUser });
});