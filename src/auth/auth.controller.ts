import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { AuthService } from './auth.service';
import { Public } from './jwt-own.guard';

export class TokenRequestDto {
  @IsString()
  @IsNotEmpty()
  userName!: string;

  @IsString()
  @IsNotEmpty()
  apiKey!: string;
}

@ApiTags('Auth')
@Controller('api/Auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('Token')
  async getToken(@Body() dto: TokenRequestDto) {
    return this.authService.issueToken(dto.userName, dto.apiKey);
  }
}
