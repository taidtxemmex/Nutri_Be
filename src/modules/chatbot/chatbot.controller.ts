import {
  Controller,
  All,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '../../common/decorators';

@ApiTags('Chatbot')
@Controller(['chatbot', 'v1/chatbot', 'api/chatbot', 'api/v1/chatbot'])
export class ChatbotController {
  @Public()
  @All([
    'message',
    'ask',
    'message/*',
    'ask/*',
    '',
    '/api/v1/chatbot/message',
    '/api/chatbot/message',
    '/api/chatbot/ask',
    '/api/v1/chatbot/ask',
  ])
  @ApiOperation({
    summary: 'Endpoint Chatbot cũ đã ngừng hoạt động vĩnh viễn (HTTP 410 Gone)',
  })
  @ApiResponse({
    status: HttpStatus.GONE,
    description: 'Dịch vụ Chatbot đã ngừng hoạt động vĩnh viễn',
  })
  handleDeprecatedChatbot() {
    throw new HttpException(
      {
        code: 'CHATBOT_DEPRECATED',
        message: 'Dịch vụ Chatbot đã ngừng hoạt động vĩnh viễn',
      },
      HttpStatus.GONE,
    );
  }
}
