using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Top11.Web.Database.Entities
{
	public class Team
	{
		public int Id { get; set; }
		public string Name { get; set; } = string.Empty;
		public int SortOrder { get; set; }
		public DateTime CreatedAt { get; set; }

		public DateTimeOffset RecoveryDateTime { get; set; } = DateTimeOffset.Now;
		public int RecoveryBonus { get; set; }

		public int AccountId { get; set; }
		public Account Account { get; set; } = null!;

		public ICollection<Player> Players { get; set; } = new List<Player>();
	}

	internal class TeamConfiguration : IEntityTypeConfiguration<Team>
	{
		public void Configure(EntityTypeBuilder<Team> builder)
		{
			builder.HasKey(e => e.Id);

			builder.Property(e => e.Id)
				.ValueGeneratedOnAdd();

			builder.Property(e => e.CreatedAt)
				  .HasDefaultValueSql("GETDATE()")
				  .ValueGeneratedOnAdd();
		}
	}
}
