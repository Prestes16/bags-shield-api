export function isString(x) {
  return typeof x === 'string' && x.trim().length > 0;
}

export function isNumber(x) {
  return typeof x === 'number' && Number.isFinite(x);
}

export function isBoolean(x) {
  return typeof x === 'boolean';
}

export function requireFields(obj, schema) {
  const errors = [];
  for (const key of Object.keys(schema)) {
    const type = schema[key];
    const val = obj[key];

    if (val === undefined || val === null || (typeof val === 'string' && !val.trim())) {
      errors.push({ field: key, message: 'Campo obrigatório ausente' });
      continue;
    }
    if (type === 'string' && !isString(val)) errors.push({ field: key, message: 'Deve ser string' });
    if (type === 'number' && !isNumber(val)) errors.push({ field: key, message: 'Deve ser number' });
    if (type === 'boolean' && !isBoolean(val)) errors.push({ field: key, message: 'Deve ser boolean' });
  }
  return { valid: errors.length === 0, errors };
}

