import { FileValidator } from '@nestjs/common';
import { fileTypeFromBuffer } from 'file-type';
import { I18nContext } from 'nestjs-i18n';
import * as fs from 'fs';

const ALLOWED_AVATAR_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

export class ImageContentTypeValidator extends FileValidator<
  Record<string, never>,
  Express.Multer.File
> {
  constructor() {
    super({});
  }

  async isValid(file?: Express.Multer.File): Promise<boolean> {
    if (!file) {
      // fileIsRequired trong ParseFilePipe đã xử lý việc bắt buộc hay không,
      // validator này chỉ quan tâm khi có file thì file đó có hợp lệ không
      return true;
    }

    const buffer = await this.readFileBuffer(file);
    const detected = await fileTypeFromBuffer(buffer);

    return !!detected && ALLOWED_AVATAR_MIME_TYPES.has(detected.mime);
  }

  buildErrorMessage(): string {
    return (
      I18nContext.current()?.t('users.AVATAR_INVALID_TYPE') ??
      'Avatar chỉ chấp nhận file ảnh'
    );
  }

  private async readFileBuffer(file: Express.Multer.File): Promise<Buffer> {
    // FileInterceptor dùng diskStorage nên file nằm trên đĩa (file.path),
    // không có sẵn file.buffer trong memory.
    if (file.buffer) {
      return file.buffer;
    }
    return fs.promises.readFile(file.path);
  }
}
