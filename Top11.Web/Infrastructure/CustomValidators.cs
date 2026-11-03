using FluentValidation;
using Microsoft.AspNetCore.Mvc;

namespace Top11.Web.Infrastructure
{

	public class ValidationExceptionHandlingMiddleware
	{
		private readonly RequestDelegate _next;

		public ValidationExceptionHandlingMiddleware(RequestDelegate next)
		{
			_next = next;
		}

		public async Task InvokeAsync(HttpContext context)
		{
			try
			{
				await _next(context);
			}
			catch (ValidationException exception)
			{
				var problemDetails = new ProblemDetails
				{
					Status = StatusCodes.Status400BadRequest,
					Type = nameof(ValidationException),
					Title = "Validation error",
					Detail = "One or more validation errors has occurred"
				};

				if (exception.Errors is not null)
				{
					problemDetails.Extensions["errors"] = exception.Errors.GroupBy(t => t.PropertyName).ToDictionary(k => FirstCharToLower(k.Key), v => v.Select(t => t.ErrorMessage));
				}

				context.Response.StatusCode = StatusCodes.Status400BadRequest;
				await context.Response.WriteAsJsonAsync(problemDetails);
			}

			static string FirstCharToLower(string input)
			{
				if (string.IsNullOrEmpty(input) || char.IsLower(input[0]))
					return input;

				return char.ToLower(input[0]) + input[1..];
			}
		}
	}

	public static class CustomValidators
	{
		public static IRuleBuilderOptions<T, string> AlphaNumericWithSpaces<T>(this IRuleBuilder<T, string> ruleBuilder)
		{
			return ruleBuilder
				.Matches("^[a-zA-Z0-9 ]+$")
				.WithMessage("The value must consist of only letters and numbers.");
		}
	}
}
