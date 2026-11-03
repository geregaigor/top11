using FluentValidation;
using Mapster;
using MediatR;
using Microsoft.AspNetCore.Http.HttpResults;
using Top11.Web.Database;
using Top11.Web.Database.Entities;
using Top11.Web.Infrastructure;

namespace Top11.Web.Api.Teams
{
	public class CreateTeam
	{
		public class Request : IRequest<Response>
		{
			public required string Name { get; set; }
			public int AccountId { get; set; }
		}

		public class Response
		{
			public int Id { get; set; }
			public required string Name { get; set; }
		}

		public class Validator : AbstractValidator<Request>
		{
			public Validator()
			{
				RuleFor(t => t.Name)
					.NotEmpty()
					.MaximumLength(50)
					.AlphaNumericWithSpaces();
			}
		}

		public class Handler : IRequestHandler<Request, Response>
		{
			private readonly IValidator<Request> _validator;
			private readonly Top11DbContext _context;

			public Handler(IValidator<Request> validator, Top11DbContext context)
			{
				_validator = validator;
				_context = context;
			}

			public async Task<Response> Handle(Request request, CancellationToken cancellationToken)
			{
				await _validator.ValidateAndThrowAsync(request, cancellationToken);

				var team = request.Adapt<Team>(TypeAdapterConfig<Request, Team>.NewConfig().Config);

				await _context.Teams.AddAsync(team);
				await _context.SaveChangesAsync();

				return team.Adapt<Response>();
			}
		}

		public class Endpoint : IEndpoint
		{
			public class RequestDto
			{
				public required string Name { get; set; }
			}

			public void MapEndpoint(IEndpointRouteBuilder app)
			{
				app.MapPost("api/teams", async Task<Ok<Response>> (RequestDto dto, IMediator mediatr, HttpContext context) =>
				{
					var userId = int.Parse(context.User.Claims.FirstOrDefault(t => t.Type == Top11CookieAuthenticationDefaults.Top11IdClimeName)?.Value);

					var request = dto.Adapt<Request>(TypeAdapterConfig<RequestDto, Request>.NewConfig()
						.Map(dest => dest.AccountId, src => userId)
						.Config);

					var result = await mediatr.Send(request);
					return TypedResults.Ok(result);
				})
					.RequireAuthorization();
			}
		}
	}
}
