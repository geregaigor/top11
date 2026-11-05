using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Top11.Web.Database.Entities
{
	public class Player
	{
		public int Id { get; set; }
		public string Name { get; set; } = string.Empty;
		public DateTime CreatedAt { get; set; }
		public Position Position { get; set; }
		public int TierUp { get; set; }
		public int SortOrder { get; set; }
		public List<string> Trainings { get; set; } = new();

		public int TeamId { get; set; }
		public Team Team { get; set; } = null!;

		public ICollection<Skill> Skills { get; set; } = new List<Skill>();
	}

	public enum Position
	{
		FIELD_PLAYER,
		GOOLKEEPER,
	}

	internal class PlayerConfiguration : IEntityTypeConfiguration<Player>
	{
		public void Configure(EntityTypeBuilder<Player> builder)
		{
			builder.HasKey(e => e.Id);

			builder.Property(e => e.Id)
				.ValueGeneratedOnAdd();

			builder.Property(e => e.Position)
				.HasConversion<string>()
				.HasMaxLength(50);

			builder.Property(e => e.CreatedAt)
				  .HasDefaultValueSql("GETDATE()")
				  .ValueGeneratedOnAdd();

			builder.Property(e => e.Trainings)
				.HasConversion(
				v => string.Join(";", v),
				v => v.Split(';', StringSplitOptions.RemoveEmptyEntries).ToList());
		}
	}
}
