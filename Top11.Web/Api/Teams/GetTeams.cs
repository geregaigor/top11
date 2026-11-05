using Mapster;
using MediatR;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Top11.Web.Database;
using Top11.Web.Database.Entities;
using Top11.Web.Infrastructure;

namespace Top11.Web.Api.Teams
{
	public class GetTeams
	{
		public class Request : IRequest<List<Response>>
		{
			public int AccountId { get; set; }
		}

		public class Response
		{
			public int Id { get; set; }
			public required string Name { get; set; }
			public DateTimeOffset RecoveryDateTime { get; set; }
			public int RecoveryBonus { get; set; }

			public List<PlayerResposne> Players { get; set; } = new List<PlayerResposne>();
			public class PlayerResposne
			{
				public int Id { get; set; }
				public string Name { get; set; } = string.Empty;
				public int TierUp { get; set; }
				public Position Position { get; set; }
				public int SortOrder { get; set; }
				public List<string> Trainings { get; set; } = new List<string>();

				public List<SkillResponse> Skills { get; set; } = new List<SkillResponse>();

				public class SkillResponse
				{
					public int PlayerId { get; set; }
					public SkillType SkillType { get; set; }
					public int Value { get; set; }
					public bool IsMain { get; set; }
					public bool IsTierUp { get; set; }
				}
			}
		}

		public class Handler : IRequestHandler<Request, List<Response>>
		{
			private readonly Top11DbContext _context;

			public Handler(Top11DbContext context)
			{
				_context = context;
			}

			public async Task<List<Response>> Handle(Request request, CancellationToken cancellationToken)
			{
				var account = await _context.Accounts
					.Include(t => t.Teams).ThenInclude(t => t.Players).ThenInclude(t => t.Skills)
					.FirstAsync(t => t.Id == request.AccountId);

				var config = new TypeAdapterConfig();
				config.NewConfig<Team, Response>()
					  .Map(dest => dest.Players, src => src.Players.Adapt<List<Response.PlayerResposne>>(config));

				var res = account.Teams.Adapt<List<Response>>(config);
				return res;
			}
		}

		public class Endpoint : IEndpoint
		{
			public void MapEndpoint(IEndpointRouteBuilder app)
			{
				app.MapGet("api/teams", async Task<Ok<List<Response>>> (IMediator mediatr, HttpContext context) =>
				{
					var accountId = context.User.GetAccountId();
					var request = new Request() { AccountId = accountId };

					var result = await mediatr.Send(request);

					return TypedResults.Ok(result);
				})
					.RequireAuthorization();
			}
		}
	}
}
