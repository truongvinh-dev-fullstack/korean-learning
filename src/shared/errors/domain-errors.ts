export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: string = "INTERNAL_ERROR",
    public readonly statusCode: number = 500
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message = "Yêu cầu đăng nhập để thực hiện thao tác này.") {
    super(message, "UNAUTHORIZED", 401);
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = "Bạn không có quyền thực hiện thao tác này.") {
    super(message, "FORBIDDEN", 403);
  }
}

export class NotFoundError extends DomainError {
  constructor(message = "Không tìm thấy dữ liệu yêu cầu.") {
    super(message, "NOT_FOUND", 404);
  }
}

export class DuplicateEnrollmentError extends DomainError {
  constructor(message = "Học viên đã đăng ký khóa học này rồi.") {
    super(message, "DUPLICATE_ENROLLMENT", 409);
  }
}

export class ContentNotPublishedError extends DomainError {
  constructor(message = "Nội dung bài học chưa được công khai.") {
    super(message, "CONTENT_NOT_PUBLISHED", 403);
  }
}

export class ConflictError extends DomainError {
  constructor(message = "Dữ liệu bị xung đột hoặc đang được sử dụng.") {
    super(message, "CONFLICT", 409);
  }
}

export class ValidationError extends DomainError {
  constructor(message = "Dữ liệu không hợp lệ.", public readonly details?: unknown) {
    super(message, "VALIDATION_ERROR", 400);
  }
}
