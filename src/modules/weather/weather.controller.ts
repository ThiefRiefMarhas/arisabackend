import { Controller, Get, Query, UseGuards, ParseFloatPipe, DefaultValuePipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { WeatherService } from './weather.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('Weather')
@Controller('weather')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('bearer')
export class WeatherController {
  constructor(private readonly weatherService: WeatherService) {}

  @Get('current')
  @ApiOperation({ summary: 'Mendapatkan data cuaca saat ini' })
  @ApiQuery({ name: 'lat', type: Number, description: 'Latitude (default: -6.9 for Bandung)' })
  @ApiQuery({ name: 'lon', type: Number, description: 'Longitude (default: 107.6 for Bandung)' })
  async getCurrentWeather(
    @Query('lat', new DefaultValuePipe(-6.9), ParseFloatPipe) lat: number,
    @Query('lon', new DefaultValuePipe(107.6), ParseFloatPipe) lon: number,
  ) {
    return this.weatherService.getCurrentWeather(lat, lon);
  }

  @Get('forecast')
  @ApiOperation({ summary: 'Mendapatkan prakiraan cuaca 5 hari ke depan' })
  @ApiQuery({ name: 'lat', type: Number, description: 'Latitude' })
  @ApiQuery({ name: 'lon', type: Number, description: 'Longitude' })
  async getForecast(
    @Query('lat', new DefaultValuePipe(-6.9), ParseFloatPipe) lat: number,
    @Query('lon', new DefaultValuePipe(107.6), ParseFloatPipe) lon: number,
  ) {
    return this.weatherService.getForecast(lat, lon);
  }
}
