import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';
import { validate, ValidationError } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ErrorCode } from '../errors/error-codes';
import { FieldError } from '../envelopes/error.envelope';

@Injectable()
export class ValidationPipe implements PipeTransform<unknown> {
  async transform(value: unknown, { metatype }: ArgumentMetadata): Promise<unknown> {
    if (!metatype || !this.toValidate(metatype)) {
      return value;
    }

    const object = plainToInstance(metatype as new (...args: unknown[]) => unknown, value);
    // whitelist:true strips properties that aren't decorated on the DTO,
    // preventing clients from smuggling extras like `status` into
    // self-edit endpoints.
    const errors = await validate(object as Record<string, unknown>, {
      whitelist: true,
    });

    if (errors.length > 0) {
      const fields = this.flattenErrors(errors);
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'Validation failed.',
        details: { fields },
      });
    }

    return object;
  }

  private toValidate(metatype: new (...args: unknown[]) => unknown): boolean {
    const types: (new (...args: unknown[]) => unknown)[] = [
      String,
      Boolean,
      Number,
      Array,
      Object,
    ];
    return !types.includes(metatype);
  }

  private flattenErrors(
    errors: ValidationError[],
    parentPath = '',
  ): FieldError[] {
    const result: FieldError[] = [];

    for (const error of errors) {
      const path = parentPath
        ? `${parentPath}.${error.property}`
        : error.property;

      if (error.constraints) {
        for (const [constraintKey, constraintMsg] of Object.entries(
          error.constraints,
        )) {
          result.push({
            field: path,
            code: this.mapConstraintToCode(constraintKey),
            message: constraintMsg,
          });
        }
      }

      if (error.children && error.children.length > 0) {
        result.push(...this.flattenErrors(error.children, path));
      }
    }

    return result;
  }

  private mapConstraintToCode(constraint: string): string {
    const mapping: Record<string, string> = {
      isNotEmpty: ErrorCode.VALIDATION_FIELD_REQUIRED,
      isDefined: ErrorCode.VALIDATION_FIELD_REQUIRED,
      isString: ErrorCode.VALIDATION_FIELD_TYPE,
      isNumber: ErrorCode.VALIDATION_FIELD_TYPE,
      isBoolean: ErrorCode.VALIDATION_FIELD_TYPE,
      isInt: ErrorCode.VALIDATION_FIELD_TYPE,
      minLength: ErrorCode.VALIDATION_FIELD_TOO_SHORT,
      maxLength: ErrorCode.VALIDATION_FIELD_TOO_LONG,
      isEmail: ErrorCode.VALIDATION_FIELD_PATTERN,
      matches: ErrorCode.VALIDATION_FIELD_PATTERN,
      isEnum: ErrorCode.VALIDATION_FIELD_ENUM,
      isUUID: ErrorCode.VALIDATION_FIELD_PATTERN,
    };
    return mapping[constraint] ?? ErrorCode.VALIDATION_FIELD_PATTERN;
  }
}
