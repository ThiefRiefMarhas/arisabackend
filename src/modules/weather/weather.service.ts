import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';

@Injectable()
export class WeatherService {
  private readonly logger = new Logger(WeatherService.name);

  /**
   * Mengambil data cuaca saat ini berdasarkan latitude dan longitude
   */
  async getCurrentWeather(lat: number, lon: number) {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m,wind_direction_10m,uv_index&timezone=Asia%2FJakarta`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Open-Meteo API Error: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        temperature: data.current.temperature_2m,
        humidity: data.current.relative_humidity_2m,
        feelsLike: data.current.apparent_temperature,
        precipitation: data.current.precipitation,
        weatherCode: data.current.weather_code,
        windSpeed: data.current.wind_speed_10m,
        windDirection: data.current.wind_direction_10m,
        uvIndex: data.current.uv_index,
        isDay: data.current.is_day === 1,
        timestamp: data.current.time,
      };
    } catch (error) {
      this.logger.error(`Error fetching current weather: ${error.message}`);
      throw new HttpException(
        'Gagal mengambil data cuaca saat ini',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  /**
   * Mengambil prakiraan cuaca harian (5 hari ke depan)
   */
  async getForecast(lat: number, lon: number) {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FJakarta&past_days=0&forecast_days=5`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Open-Meteo API Error: ${response.statusText}`);
      }

      const data = await response.json();
      const daily = data.daily;
      
      const forecast = [];
      for (let i = 0; i < daily.time.length; i++) {
        forecast.push({
          date: daily.time[i],
          weatherCode: daily.weather_code[i],
          tempMax: daily.temperature_2m_max[i],
          tempMin: daily.temperature_2m_min[i],
          precipProb: daily.precipitation_probability_max[i],
        });
      }
      
      return forecast;
    } catch (error) {
      this.logger.error(`Error fetching weather forecast: ${error.message}`);
      throw new HttpException(
        'Gagal mengambil prakiraan cuaca',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}
