import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const PASSWORD_MIN_LENGTH = 12;

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @IsNotEmpty()
  email!: string;

  @ApiProperty({
    example: 'strongPassword123!@#',
    minLength: PASSWORD_MIN_LENGTH,
  })
  @IsString()
  // S006: không nhúng tên/giá trị hằng số vào message hiển thị cho người dùng
  @MinLength(PASSWORD_MIN_LENGTH, {
    message: 'Password quá ngắn, vui lòng nhập nhiều ký tự hơn',
  })
  @IsNotEmpty()
  password!: string;

  @ApiPropertyOptional({ example: 'Nguyen Van A' })
  @IsString()
  @IsOptional()
  name?: string;
}
