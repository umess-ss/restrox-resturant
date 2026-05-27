import { validationResult } from 'express-validator';

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const details = errors.array();
    return res.status(422).json({
      message: details[0]?.msg || 'Validation failed',
      errors: details,
    });
  }
  next();
};

export default validate;
