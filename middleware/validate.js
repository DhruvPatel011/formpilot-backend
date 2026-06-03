const { validationResult } = require('express-validator');
const ApiResponse = require('../utils/apiResponse');

const validate = (validations) => {
  return async (req, res, next) => {
    // Run all validations
    for (const validation of validations) {
      const result = await validation.run(req);
      if (!result.isEmpty()) break;
    }

    const errors = validationResult(req);
    if (errors.isEmpty()) return next();

    const formatted = errors.array().map(e => ({
      field: e.path,
      message: e.msg,
    }));

    return ApiResponse.validationError(res, formatted);
  };
};

module.exports = validate;
