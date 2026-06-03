/**
 * Standardized API response helpers
 */
class ApiResponse {
  static success(res, data = {}, message = 'Success', statusCode = 200) {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  static created(res, data = {}, message = 'Created successfully') {
    return this.success(res, data, message, 201);
  }

  static error(res, message = 'Something went wrong', statusCode = 500, errors = null) {
    const response = {
      success: false,
      message,
      timestamp: new Date().toISOString(),
    };
    if (errors) response.errors = errors;
    if (process.env.NODE_ENV === 'development') {
      response.debug = message;
    }
    return res.status(statusCode).json(response);
  }

  static unauthorized(res, message = 'Unauthorized access') {
    return this.error(res, message, 401);
  }

  static forbidden(res, message = 'Access forbidden') {
    return this.error(res, message, 403);
  }

  static notFound(res, message = 'Resource not found') {
    return this.error(res, message, 404);
  }

  static validationError(res, errors, message = 'Validation failed') {
    return this.error(res, message, 422, errors);
  }

  static conflict(res, message = 'Resource already exists') {
    return this.error(res, message, 409);
  }
}

module.exports = ApiResponse;
