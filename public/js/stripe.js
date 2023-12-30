/* eslint-disable */
import axios from 'axios';
import { showAlert, hideAlert } from './alert';

// Public key
const stripe = Stripe(
  'pk_test_51OScg5CuMHqfKqZWtOUyDOQIHvI11iodCfUFbF0c7GeyTZaDRV2XQtdVm1PIxTS4xoKCJK9aNtVHteiEXmQ0UBww00D6pnCAdJ'
);

export const bookTour = async tourId => {
  try {
    // 1. Get checkout session from api
    const session = await axios(`/api/v1/bookings/checkout-session/${tourId}`); // for get requests we only need to specify the url without the method
    console.log(session);
    // 2. User stripe object to create checkout form + process credict card
    await stripe.redirectToCheckout({
      sessionId: session.data.session.id
    });
  } catch (err) {
    console.log(err);
    showAlert('error', err);
  }
};
