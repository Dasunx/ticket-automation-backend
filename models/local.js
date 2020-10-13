const mongoose = require('mongoose');
const User = require('./user');

const options = { discriminatorKey: 'kind' };

const Local = User.discriminator(
  'Local',
  new mongoose.Schema(
    {
      nic: {
        type: String,
        required: true,
      },
      balance: {
        type: Number,
        default: 0.0,
      },
      ongoing: {
        type: Boolean,
        default: false,
      },
      journey: {
        type: mongoose.Types.ObjectId,
        ref: 'Journey',
      },
    },
    options
  )
);

module.exports = Local;