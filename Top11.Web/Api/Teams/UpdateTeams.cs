using FluentValidation;
using MediatR;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Top11.Web.Database;
using Top11.Web.Database.Entities;
using Top11.Web.Infrastructure;

namespace Top11.Web.Api.Teams
{
	public class UpdateTeams
	{
		public class Request : IRequest
		{
			public int AccountId { get; set; }
			public required List<Team> Teams { get; set; }
			public class Team
			{
				public int Id { get; set; }
				public required string Name { get; set; }
				public int SortOrder { get; set; }
				public DateTimeOffset RecoveryDateTime { get; set; }
				public int RecoveryBonus { get; set; }

				public List<Player> Players { get; set; } = new();
				public class Player
				{
					public int Id { get; set; }
					public required string Name { get; set; }
					public Position Position { get; set; }
					public int TierUp { get; set; }
					public int SortOrder { get; set; }
					public List<Skill> Skills { get; set; } = new();
					public List<string> Trainings { get; set; } = new();

					public class Skill
					{
						public int PlayerId { get; set; }
						public SkillType SkillType { get; set; }
						public int Value { get; set; }
						public bool IsMain { get; set; }
						public bool IsTierUp { get; set; }
					}
				}
			}
		}

		public class Handler : IRequestHandler<Request>
		{
			private readonly IValidator<Request> _validator;
			private readonly Top11DbContext _context;

			public Handler(Top11DbContext context)
			{
				_context = context;
			}

			public async Task Handle(Request request, CancellationToken cancellationToken)
			{
				var account = _context.Accounts
					.Include(t => t.Teams)
					.ThenInclude(t => t.Players)
					.ThenInclude(t => t.Skills)
					.First(t => t.Id == request.AccountId)
					?? throw new Exception("Account not found " + request.AccountId);

				UpdateTeams();
				await _context.SaveChangesAsync();

				void UpdateTeams()
				{
					account.Teams.Where(t => !request.Teams.Any(rt => rt.Id == t.Id))
						.ToList()
						.ForEach(t => account.Teams.Remove(t));

					request.Teams.ForEach(rt =>
					{
						var t = account.Teams.FirstOrDefault(t => t.Id == rt.Id);
						if (t == null)
						{
							t = new Team();
							account.Teams.Add(t);
						}
						UpdateTeam(t, rt);
					});
				};

				void UpdateTeam(Team t, Request.Team rt)
				{
					t.Name = rt.Name;
					t.SortOrder = rt.SortOrder;
					t.RecoveryBonus = rt.RecoveryBonus;
					t.RecoveryDateTime = rt.RecoveryDateTime;
					t.SortOrder = rt.SortOrder;

					t.Players.Where(p => !rt.Players.Any(rp => rp.Id == p.Id))
						.ToList()
						.ForEach(p => t.Players.Remove(p));

					rt.Players.ForEach(rp =>
					{
						var p = t.Players.FirstOrDefault(p => rp.Id == p.Id);
						if (p == null || p.Id == 0)
						{
							p = new Player();
							t.Players.Add(p);
						}
						UpdatePlayer(p, rp);
					});
				};

				void UpdatePlayer(Player p, Request.Team.Player rp)
				{
					p.Name = rp.Name;
					p.TierUp = rp.TierUp;
					p.Position = rp.Position;
					p.SortOrder = rp.SortOrder;

					p.Skills.Where(s => !rp.Skills.Any(rs => rs.SkillType == s.SkillType))
						.ToList()
						.ForEach(s => p.Skills.Remove(s));
					p.Trainings = rp.Trainings;

					rp.Skills.ForEach(rs =>
					{
						var s = p.Skills.FirstOrDefault(s => s.SkillType == rs.SkillType);
						if (s == null)
						{
							s = new Skill() { PlayerId = rs.PlayerId, SkillType = rs.SkillType };
							p.Skills.Add(s);
						}
						UpdateSkill(s, rs);
					});
				}

				void UpdateSkill(Skill s, Request.Team.Player.Skill rs)
				{
					s.IsMain = rs.IsMain;
					s.IsTierUp = rs.IsTierUp;
					s.Value = rs.Value;
				}
			}
		}

		public class Endpoint : IEndpoint
		{
			public void MapEndpoint(IEndpointRouteBuilder app)
			{
				app.MapPut("api/teams", async Task<Ok> (List<Request.Team> request, IMediator mediatr, HttpContext context) =>
				{
					var accountId = int.Parse(context.User.Claims.FirstOrDefault(t => t.Type == Top11CookieAuthenticationDefaults.Top11IdClimeName)?.Value);
					await mediatr.Send(new Request() { Teams = request, AccountId = accountId });
					return TypedResults.Ok();
				})
					.RequireAuthorization();
			}
		}
	}
}
