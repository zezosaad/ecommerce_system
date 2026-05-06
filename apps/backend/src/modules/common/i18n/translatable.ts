import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';

export function IsTranslatable(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isTranslatable',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          if (!value || typeof value !== 'object') return false;
          const obj = value as Record<string, unknown>;
          const keys = Object.keys(obj);
          if (keys.length === 0) return false;
          const hasExtraKeys = keys.some(
            (k) => k !== 'ar' && k !== 'en',
          );
          if (hasExtraKeys) return false;
          const ar = typeof obj.ar === 'string' ? (obj.ar as string).trim() : '';
          const en = typeof obj.en === 'string' ? (obj.en as string).trim() : '';
          return ar.length > 0 || en.length > 0;
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be a translatable object { ar, en } with at least one non-empty value.`;
        },
      },
    });
  };
}
