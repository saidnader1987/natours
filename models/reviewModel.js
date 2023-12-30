const mongoose = require('mongoose');
const Tour = require('./tourModel');

const reviewSchema = new mongoose.Schema(
  {
    review: {
      type: String,
      required: [true, 'Review can not be empty!']
    },
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'Review must belong to a user']
    },
    tour: {
      type: mongoose.Schema.ObjectId,
      ref: 'Tour',
      required: [true, 'Review must belong to a tour']
    }
  },
  { toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

reviewSchema.index({ tour: 1, user: 1 }, { unique: true });

reviewSchema.pre(/^find/, function(next) {
  // this.populate({
  //   path: 'tour',
  //   select: 'name'
  // }).populate({
  //   path: 'user',
  //   select: 'name photo'
  // });
  // next();
  this.populate({
    path: 'user',
    select: 'name photo'
  });
  next();
});

reviewSchema.statics.calcAverageRatings = async function(tourId) {
  // this points to the current model
  const stats = await this.aggregate([
    {
      $match: { tour: tourId }
    },
    {
      $group: {
        _id: '$tour',
        nRating: { $sum: 1 },
        avgRating: { $avg: '$rating' }
      }
    }
  ]);
  // console.log(stats);
  if (stats.length > 0) {
    await Tour.findByIdAndUpdate(tourId, {
      ratingsQuantity: stats[0].nRating,
      ratingsAverage: stats[0].avgRating
    });
  } else {
    await Tour.findByIdAndUpdate(tourId, {
      ratingsQuantity: 0,
      ratingsAverage: 4.5
    });
  }
};

// We use post so that the just created review is taken into account for the calculations. For post save middleware we do not need the next function
reviewSchema.post('save', function() {
  // this points to current review
  // this.constructor points to the model that created the document. We can't use Review.calcAverageRatings here because Review is not yet defined, and we actually need to set this middleware on the reviewSchema before instantiating the Review.
  this.constructor.calcAverageRatings(this.tour);
});

// for updating or deleting: findByIdAndUpdate findByIdAndDelete
reviewSchema.pre(/^findOneAnd/, async function(next) {
  // this points to the current query
  this.document = await this.findOne(); // finds the document in the db
  // console.log(this.document);
  next();
});

reviewSchema.post(/^findOneAnd/, async function(next) {
  // await this.findOne(); does not work here, query has already executed
  await this.document?.constructor.calcAverageRatings(this.document.tour);
});

const Review = mongoose.model('Review', reviewSchema);

module.exports = Review;
