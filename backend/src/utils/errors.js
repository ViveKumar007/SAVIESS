// Sends a 500 response for a caught DB/transaction error. In production the
// raw error.message is withheld (it can leak schema/query details); in every
// other environment it's appended after the public message for debugging.
const sendDbError = (res, error, publicMessage, statusCode = 500) => {
  const message = process.env.NODE_ENV === 'production'
    ? publicMessage
    : `${publicMessage}: ${error.message}`;
  res.status(statusCode).json({ success: false, error: message });
};

module.exports = { sendDbError };
