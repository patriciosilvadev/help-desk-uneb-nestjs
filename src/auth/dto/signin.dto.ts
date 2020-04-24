import { MaxLength, MinLength, IsString } from 'class-validator';
import {
  usernameMinLength,
  usernameMaxLength,
  passwordMinLength,
} from '../user.constants';
import { ApiProperty } from '@nestjs/swagger';

export class SignInDto {
  @IsString()
  @MinLength(usernameMinLength)
  @MaxLength(usernameMaxLength)
  @ApiProperty({
    description: 'Login do Usuário',
    minLength: usernameMinLength,
    maxLength: usernameMaxLength,
    type: String,
  })
  username: string;

  @IsString()
  @MinLength(passwordMinLength)
  @ApiProperty({
    description: 'Senha do Usuário',
    minLength: passwordMinLength,
    type: String,
  })
  password: string;
}
