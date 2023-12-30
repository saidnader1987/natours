const Stripe = require('stripe');
const AppError = require('../util/appError');
const Tour = require('./../models/tourModel');
const catchAsync = require('./../util/catchAsync');
const factory = require('./handlerFactory');
const Booking = require('./../models/bookingModel');

exports.getCheckoutSession = catchAsync(async (req, res, next) => {
  // 1. Get the currently booked tour
  const tour = await Tour.findById(req.params.tourId);

  // 2. Create checkout session
  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
  // this will make an api call to stripe so we need to await it
  const session = await stripe.checkout.sessions.create({
    // Session info
    payment_method_types: ['card'],
    success_url: `${req.protocol}://${req.get('host')}/?tour=${
      req.params.tourId
    }&user=${req.user.id}&price=${tour.price}`,
    cancel_url: `${req.protocol}://${req.get('host')}/tour/${tour.slug}`,
    customer_email: req.user.email,
    client_reference_id: req.params.tourId,
    mode: 'payment',
    // Products info
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: tour.price * 100, // cents
          product_data: {
            name: `${tour.name} Tour`,
            description: tour.summary,
            images: [`https://www.natours.dev/img/tours/${tour.imageCover}`] // We will change this later for production. It needs to be an image hosted on the internet
          }
        }
      }
    ]
  });

  // 3. Send session as response
  res.status(200).json({
    status: 'success',
    session
  });
});

exports.createBookingCheckout = catchAsync(async (req, res, next) => {
  // This is only TEMPORARY, because it's unsecure. Everyone can book a tour for free
  const { tour, user, price } = req.query;
  if (!tour && !user && !price) return next();
  await Booking.create({ tour, user, price });

  // cut the ?tour=${req.params.tourId}&user=${req.user.id}&price=${tour.price} out of the url
  res.redirect(req.originalUrl.split('?')[0]); // this creates a new request based on this url. Redirect to '/' and this time there's no query string so next will be called
});

exports.createBooking = factory.createOne(Booking);
exports.getBooking = factory.getOne(Booking);
exports.getAllBookings = factory.getAll(Booking);
exports.updateBooking = factory.updateOne(Booking);
exports.deleteBooking = factory.deleteOne(Booking);
