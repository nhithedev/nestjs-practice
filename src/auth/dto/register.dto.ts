import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { i18nValidationMessage } from 'nestjs-i18n';

const PASSWORD_MIN_LENGTH = 12;

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail({}, { message: i18nValidationMessage('validation.emailInvalid') })
  @IsNotEmpty()
  email!: string;

  @ApiProperty({
    example: 'strongPassword123!@#',
    minLength: PASSWORD_MIN_LENGTH,
  })
  @IsString()
  // S006: không nhúng tên/giá trị hằng số vào message hiển thị cho người dùng
  @MinLength(PASSWORD_MIN_LENGTH, {
    message: i18nValidationMessage('validation.passwordTooShort'),
  })
  @IsNotEmpty()
  password!: string;

  @ApiPropertyOptional({ example: 'Nguyen Van A' })
  @IsString()
  @IsOptional()
  name?: string;
}
